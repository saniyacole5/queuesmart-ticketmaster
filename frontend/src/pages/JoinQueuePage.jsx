import ScreenTemplate from "../components/ScreenTemplate";

export default function JoinQueuePage() {
  return (
    <ScreenTemplate
      title="Join Queue"
      description="Let a user select and join an available service queue."
      requirements={[
        "Add a service selector",
        "Display the estimated wait time",
        "Add join and leave queue controls",
      ]}
    />
  );
}
