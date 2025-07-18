import { router } from "@/helpers/server/trpc";
import { getCachedAnalysis } from "./getCachedAnalysis";
import { saveCachedAnalysis } from "./saveCachedAnalysis";

export const aiRouter = router({
  getCachedAnalysis,
  saveCachedAnalysis,
});
