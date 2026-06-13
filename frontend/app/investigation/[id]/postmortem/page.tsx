export default function PostmortemPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Postmortem — {params.id}</h1>
      {/* Postmortem components will be implemented in a later task */}
    </main>
  );
}
