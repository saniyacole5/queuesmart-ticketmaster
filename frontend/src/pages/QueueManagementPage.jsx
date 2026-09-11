import ScreenTemplate from "../components/ScreenTemplate";

export default function QueueManagementPage() {
  return (
    <ScreenTemplate
      title="Queue Management"
      description="Allow administrators to manage a selected service queue."
      requirements={[
        "Select a service and display its queue",
        "Add UI controls to reorder users",
        "Add a UI control to remove a user",
        "Add a simulated Serve Next User action",
      ]}
    />
  );
}
