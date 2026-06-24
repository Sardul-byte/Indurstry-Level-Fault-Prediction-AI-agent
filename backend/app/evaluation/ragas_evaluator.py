"""
RAGAS evaluation metrics calculation.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Any

from sqlalchemy import select
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision, context_recall
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from langchain_community.embeddings import HuggingFaceEmbeddings

from app.core.database import AsyncSessionLocal
from app.models.investigation import Investigation
from app.models.agent_output import AgentOutput
from app.models.ragas_metrics import RAGASMetrics
from app.llm.provider import LLMProvider
from app.core.logging import get_logger

logger = get_logger(__name__)


async def evaluate_investigation(investigation_id: str) -> None:
    """Computes RAGAS metrics for an investigation and persists them to the database."""
    logger.info("ragas_evaluation_start", investigation_id=investigation_id)

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # 1. Fetch Investigation
            stmt = select(Investigation).where(Investigation.id == investigation_id)
            res = await session.execute(stmt)
            investigation = res.scalar_one_or_none()

            if not investigation:
                logger.error("investigation_not_found", investigation_id=investigation_id)
                return

            # 2. Fetch Agent Outputs
            stmt_outputs = select(AgentOutput).where(AgentOutput.investigation_id == investigation_id)
            res_outputs = await session.execute(stmt_outputs)
            agent_outputs = res_outputs.scalars().all()

            outputs_dict = {ao.agent_name: ao.output for ao in agent_outputs}

            # Extract inputs for RAGAS
            # Alert summary
            alert_out = outputs_dict.get("alert_agent")
            # Log summary
            log_out = outputs_dict.get("log_analysis_agent")
            # Retrieval context
            retrieval_out = outputs_dict.get("retrieval_agent")
            # RCA result
            rca_out = outputs_dict.get("rca_agent")
            # Postmortem
            postmortem_out = outputs_dict.get("postmortem_agent")

            # Construct dataset inputs
            # Question (Query)
            question = ""
            if alert_out:
                alert_type = alert_out.get("alert_type", "custom")
                severity = alert_out.get("severity", "low")
                services = ", ".join(alert_out.get("impacted_services", []))
                question = f"Alert type: {alert_type}. Severity: {severity}. Impacted services: {services}."
            else:
                alert_payload = investigation.alert_payload or {}
                question = f"Incident Alert: {json.dumps(alert_payload)}"

            # Contexts
            contexts: list[str] = []
            if retrieval_out and "excerpts" in retrieval_out:
                contexts = [e.get("content", "") for e in retrieval_out["excerpts"] if e.get("content")]

            # Answer
            answer = ""
            if postmortem_out and "sections" in postmortem_out:
                answer = "\n\n".join(
                    f"## {s.get('heading', '')}\n{s.get('body', '')}"
                    for s in postmortem_out["sections"]
                    if s.get("body")
                )
            elif investigation.log_data:
                answer = investigation.log_data[:1000]

            # Ground truth
            ground_truth = "Unknown root cause"
            if rca_out and "hypotheses" in rca_out and rca_out["hypotheses"]:
                best_hyp = rca_out["hypotheses"][0]
                ground_truth = best_hyp.get("hypothesis", "Unknown root cause")
            elif log_out:
                anom = list(log_out.get("anomalies", {}).keys())
                patterns = [fp.get("signature", "") for fp in log_out.get("failure_patterns", [])]
                ground_truth = f"Anomalies: {', '.join(anom)}. Patterns: {', '.join(patterns)}"

            # 3. Setup LLM & Embeddings for RAGAS
            try:
                llm = LLMProvider.get()
                ragas_llm = LangchainLLMWrapper(llm=llm)

                # Setup embeddings
                langchain_embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
                ragas_embeddings = LangchainEmbeddingsWrapper(embeddings=langchain_embeddings)
            except Exception as e:
                logger.error("ragas_setup_failed", error=str(e))
                # Persist empty metrics row if RAGAS cannot be initialized
                metrics = RAGASMetrics(
                    investigation_id=investigation_id,
                    faithfulness=None,
                    context_precision=None,
                    context_recall=None,
                    answer_relevance=None,
                )
                session.add(metrics)
                return

            # Prepare evaluation dataset
            data = {
                "question": [question],
                "contexts": [contexts],
                "answer": [answer],
                "ground_truth": [ground_truth]
            }
            dataset = Dataset.from_dict(data)

            # Run metrics in threadpool to avoid blocking
            loop = asyncio.get_running_loop()

            async def run_metric_eval(metric_obj) -> float | None:
                try:
                    res = await loop.run_in_executor(
                        None,
                        lambda: evaluate(
                            dataset=dataset,
                            metrics=[metric_obj],
                            llm=ragas_llm,
                            embeddings=ragas_embeddings
                        )
                    )
                    score = res.get(metric_obj.name)
                    if score is not None:
                        return float(score)
                    return None
                except Exception as ex:
                    logger.error("ragas_metric_error", metric=metric_obj.name, error=str(ex))
                    return None

            # Compute each score
            score_faithfulness = await run_metric_eval(faithfulness)
            score_answer_relevance = await run_metric_eval(answer_relevancy)
            score_context_precision = await run_metric_eval(context_precision)
            score_context_recall = await run_metric_eval(context_recall)

            # Persist computed scores
            metrics = RAGASMetrics(
                investigation_id=investigation_id,
                faithfulness=score_faithfulness,
                context_precision=score_context_precision,
                context_recall=score_context_recall,
                answer_relevance=score_answer_relevance,
            )
            session.add(metrics)

            logger.info(
                "ragas_evaluation_complete",
                investigation_id=investigation_id,
                faithfulness=score_faithfulness,
                answer_relevance=score_answer_relevance,
                context_precision=score_context_precision,
                context_recall=score_context_recall,
            )
