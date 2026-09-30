// TODO: Add temporary services used by the user and admin screens.
export const services = [
    {
        id: 1,
        name: "Concert Ticket Queue",
        description: "Queue for availableconcert tickets.",
        estimatedWait: 12,
        priority: "high",
        isOpen: true,
    },
    {
        id: 2,
        name: "Texans Ticket Queue",
        description: "Queue for available Texans tickets.",
        estimatedWait: 20,
        priority: "medium",
        isOpen: true,
    },
    {
        id: 3,
        name: "Rockets Ticket Queue",
        description: "Queue for available Rockets tickets.",
        estimatedWait: 3,
        priority: "low",
        isOpen: false,
    },
];

// Temporary users waiting in each queue, used by the Queue Management screen.
// Array order within a service is the queue order; position is derived from it.
export const queueEntries = [
    { id: 101, serviceId: 1, name: "Jordan User", joinedAt: "10:02 AM", priority: "standard" },
    { id: 102, serviceId: 1, name: "Marcus Bell", joinedAt: "10:05 AM", priority: "priority" },
    { id: 103, serviceId: 1, name: "Dana Whitfield", joinedAt: "10:09 AM", priority: "standard" },
    { id: 104, serviceId: 1, name: "Priya Raman", joinedAt: "10:14 AM", priority: "standard" },
    { id: 105, serviceId: 2, name: "Chris Okafor", joinedAt: "9:47 AM", priority: "priority" },
    { id: 106, serviceId: 2, name: "Elena Vasquez", joinedAt: "9:52 AM", priority: "standard" },
    { id: 107, serviceId: 2, name: "Sam Lindqvist", joinedAt: "10:01 AM", priority: "standard" },
    { id: 108, serviceId: 3, name: "Taylor Nguyen", joinedAt: "10:20 AM", priority: "standard" },
];

// TODO: Add temporary notification objects.
export const notifications = [
    {
        id: 1,
        message: "You moved up to position #7 in the Concert Ticket Queue.",
        time: "2 minutes ago",
    },
    {
        id: 2,
        message: "Your estimated wait time is now 12 minutes.",
        time: "5 minutes ago",
    },
    {
        id: 3,
        message: "The Concert Ticket Queue is currently active.",
        time: "10 minutes ago",
    },
];

// TODO: Add temporary queue-history objects.
export const queueHistory = [
    {
        id:1,
        date: "Sep 12, 2026",
        serviceName: "Concert Ticket Queue",
        outcome: "Served",
    },
    {
        id: 2,
        date: "Sep 10, 2026",
        serviceName: "Texans Ticket Queue",
        outcome: "Left Queue",
    },
    {
        id: 3,
        date: "August 28, 2026",
        serviceName: "Rockets Ticket Queue",
        outcome: "Purchased",
    }
];

// Temporary data for the Queue Status screen.
export const currentQueue = {
    serviceName: "Concert Ticket Queue",
    position: 7,
    estimatedWait: 12,
    status: "Waiting",
};
