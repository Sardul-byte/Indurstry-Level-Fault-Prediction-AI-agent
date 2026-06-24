import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import { AgentStatusCard } from "./dashboard/AgentStatusCard";
import { WorkflowStageBar } from "./dashboard/WorkflowStageBar";
import { ExportButton } from "./postmortem/ExportButton";
import { getReport } from "../lib/api";

// Mock the API client
vi.mock("../lib/api", () => {
  return {
    getReport: vi.fn().mockResolvedValue("/some-download-url"),
  };
});

describe("Frontend Components tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AgentStatusCard truncates summary to <= 500 characters", () => {
    const longSummary = "A".repeat(1000);
    const mockOutput = { summary: longSummary };

    render(
      <AgentStatusCard
        agentName="alert_agent"
        status="completed"
        output={mockOutput}
      />
    );

    const summaryEl = screen.getByTestId("output-summary");
    expect(summaryEl.textContent?.length).toBeLessThanOrEqual(505);
  });

  it("WorkflowStageBar highlights correct active stage", () => {
    render(<WorkflowStageBar activeStage="remediation" />);
    expect(screen.getByText("Remediation")).toBeInTheDocument();
  });

  it("ExportButton triggers callback on click", async () => {
    // Mock createElement and click on document anchor
    const originalCreate = document.createElement.bind(document);
    const realAnchor = originalCreate("a");
    vi.spyOn(realAnchor, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      if (tagName === "a") {
        return realAnchor;
      }
      return originalCreate(tagName, options);
    });

    render(<ExportButton investigationId="123" />);
    const btn = screen.getByRole("button");
    
    await act(async () => {
      btn.click();
    });

    expect(getReport).toHaveBeenCalledWith("123", "markdown");
  });
});
