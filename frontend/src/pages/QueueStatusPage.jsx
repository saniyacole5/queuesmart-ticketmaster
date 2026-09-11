import ScreenTemplate from "../components/ScreenTemplate";

export default function QueueStatusPage() {
  return (
    <ScreenTemplate
      title="Queue Status"
      description="Show live or simulated information about the user's queue."
      requirements={[
        "Show the current queue position",
        "Show the estimated wait time",
        "Show waiting, almost ready, and served states",
      ]}
    />
  );
}
