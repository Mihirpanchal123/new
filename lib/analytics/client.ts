"use client";

import { createAnalytics } from "./index";

/** Browser-side analytics instance (provider chosen by NEXT_PUBLIC_ANALYTICS_PROVIDER). */
export const analytics = createAnalytics(process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER);
