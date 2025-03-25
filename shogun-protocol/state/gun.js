// import Gun from "gun/gun";
// import "gun/sea";
// import "gun/lib/radix";
// import "gun/lib/radisk";
// import "gun/lib/store";
// import "gun/lib/rindexed";

// let DEV_MODE = import.meta.env.DEV;

// let gun = new Gun({
//   peers: ["http://localhost:8765/gun"],
//   axe: false,
//   localStorage: false,
//   radisk: false,
// });

// let user = gun.user().recall({ sessionStorage: true });

import { gun, user } from "./shogun-integration";

export { gun, user };
