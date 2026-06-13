export default function RecommendationsPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">
        Recommendations — {params.id}
      </h1>
      {/* Recommendation components will be implemented in a later task */}
    </main>
  );
}
