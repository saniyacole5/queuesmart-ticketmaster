import ScreenTemplate from "../components/ScreenTemplate";

export default function HistoryPage() {
  return (
    <ScreenTemplate
      title="Queue History"
      description="List queues the user previously joined."
      requirements={[
        "Display the date",
        "Display the service name",
        "Display the outcome",
      ]}
    />
  );
}
