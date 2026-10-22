// MEMBER 2: services, wait-time estimation, admin service integration.
import * as v from "../shared/validation.js";
import { fail } from "../shared/errors.js";
export function getService(store, id) {
  const service = store.services.find((s) => s.id === id);
  if (!service) fail(404, "SERVICE_NOT_FOUND", "Service not found.");
  return service;
}
export function createServices(store) {
  function fields(body, partial = false) {
    v.object(body, [
      "name",
      "description",
      "expectedDuration",
      "priority",
      "isOpen",
    ]);
    if (partial && !Object.keys(body).length)
      fail(400, "VALIDATION_ERROR", "Provide at least one field.");
    const output = {};
    for (const [key, validate] of Object.entries({
      name: () => v.text(body, "name", 1, 100),
      description: () => v.text(body, "description", 1, 500),
      expectedDuration: () => v.integer(body, "expectedDuration", 1, 480),
      priority: () => v.choice(body, "priority", ["low", "medium", "high"]),
      isOpen: () => v.boolean(body, "isOpen"),
    })) {
      if ((!partial && key !== "isOpen") || Object.hasOwn(body, key))
        output[key] = validate();
    }
    return output;
  }
// Compare names and ignoring spaces and capitalization.
function checkDuplicateName(name, excludeId) {
  const normalizedName = name.trim().toLowerCase();

  const duplicate = store.services.some(
      (service) =>
        service.id !== excludeId &&
      service.name.trim().toLowerCase() === normalizedName,
  );
  if (duplicate) {
    fail(
      409, 
      "SERVICE_NAME_CONFLICT", 
      "A service with this name already exists.",
    );
  }
}

return {
  list: () => store.services.map((s) => ({ ...s })),

  create(body) {
    const validatedFields = fields(body);
    checkDuplicateName(validatedFields.name);

    const service = {
      id: store.nextId(),
      isOpen: true,
      ...validatedFields,
    };

    store.services.push(service);
    return service;
  },

  update(id, body) {
    const service = getService(store, id);
    const validatedFields = fields(body, true);

    // Allow service to keeps its own name.
    if (Object.hasOwn(validatedFields, "name")) {
      checkDuplicateName(validatedFields.name, id);
    }
    // Change the service only after all checks pass.
    Object.assign(service, validatedFields);
    return service;
    },
  };
}
