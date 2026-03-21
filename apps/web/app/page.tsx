export default function HomePage() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold">Welcome to SQL Sandbox</h2>
        <p className="text-muted-foreground">
          Interactive PostgreSQL learning and debugging platform
        </p>
        <p className="text-sm text-muted-foreground">
          Create a workspace to get started.
        </p>
      </div>
    </div>
  );
}
