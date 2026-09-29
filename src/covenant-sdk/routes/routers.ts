import workRoutes from "./works";
import sweepDirectRoutes from "./sweep-direct";
import sweepAsyncRoutes from "./sweep-async";
import luminateRoutes from "./luminate";
import phoneRoutes from "./phone";

export const covenantRouters = {
  works: workRoutes,
  sweepDirect: sweepDirectRoutes,
  sweepAsync: sweepAsyncRoutes,
  luminate: luminateRoutes,
  phone: phoneRoutes,
};

export {
  workRoutes,
  sweepDirectRoutes,
  sweepAsyncRoutes,
  luminateRoutes,
  phoneRoutes,
};
