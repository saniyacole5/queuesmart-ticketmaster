import ScreenTemplate from "../components/ScreenTemplate";

export default function AdminDashboardPage() {
  return (
    <ScreenTemplate
      title="Admin Dashboard"
      description="Give administrators a high-level queue overview."
      requirements={[
        "List available services",
        "Show current queue lengths",
        "Add open and close queue actions",
      ]}
    />
  );
}
