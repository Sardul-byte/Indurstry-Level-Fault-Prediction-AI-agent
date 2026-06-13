export default function RootCausePage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Root Cause Analysis — {params.id}</h1>
      {/* RCA components will be implemented in a later task */}
    </main>
  );
}
