// TODO: Add temporary services used by the user and admin screens.
export const services = [
    {
        id: 1,
        name: "Concert Ticket Queue",
        description: "Queue for availableconcert tickets.",
        estimatedWait: 12,
    },
    {
        id: 2,
        name: "Texans Ticket Queue",
        description: "Queue for available Texans tickets.",
        estimatedWait: 20,
    },
    {
        id: 3,
        name: "Rockets Ticket Queue",
        description: "Queue for available Rockets tickets.",
        estimatedWait: 3,
    },
];

// TODO: Add temporary users for the Queue Management screen.
export const queueEntries = [];

// TODO: Add temporary notification objects.
export const notifications = [];

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
