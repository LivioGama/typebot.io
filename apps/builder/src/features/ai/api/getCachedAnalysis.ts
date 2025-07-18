import { authenticatedProcedure } from "@/helpers/server/trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "@typebot.io/prisma";
import { z } from "zod";
import type { CachedAnalysisResult } from "../types";

export const getCachedAnalysis = authenticatedProcedure
  .input(
    z.object({
      fileHash: z.string(),
      apiKeyHash: z.string(),
      workspaceId: z.string(),
    }),
  )
  .output(
    z
      .object({
        id: z.string(),
        fileHash: z.string(),
        fileName: z.string(),
        fileSize: z.number(),
        mimeType: z.string(),
        createdAt: z.date(),
        analysisResult: z.array(z.any()), // DetectedElement array
      })
      .nullable(),
  )
  .query(
    async ({ input: { fileHash, apiKeyHash, workspaceId }, ctx: { user } }) => {
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          members: {
            some: {
              userId: user.id,
            },
          },
        },
      });

      if (!workspace) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Workspace not found",
        });
      }

      const cachedResult = await prisma.imageAnalysisCache.findFirst({
        where: {
          fileHash,
          apiKey: apiKeyHash,
          workspaceId,
        },
        select: {
          id: true,
          fileHash: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          createdAt: true,
          analysisResult: true,
        },
      });

      if (!cachedResult) {
        return null;
      }

      return {
        ...cachedResult,
        analysisResult: cachedResult.analysisResult as any[], // Cast from Json to array
      } as CachedAnalysisResult;
    },
  );
