export default function InvestigationDashboardPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">
        Investigation Dashboard — {params.id}
      </h1>
      {/* Dashboard components will be implemented in a later task */}
    </main>
  );
}
