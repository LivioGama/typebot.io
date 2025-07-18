import { authenticatedProcedure } from "@/helpers/server/trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "@typebot.io/prisma";
import { z } from "zod";

export const saveCachedAnalysis = authenticatedProcedure
  .input(
    z.object({
      fileHash: z.string(),
      apiKeyHash: z.string(),
      workspaceId: z.string(),
      fileName: z.string(),
      fileSize: z.number(),
      mimeType: z.string(),
      analysisResult: z.array(z.any()), // DetectedElement array
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
    }),
  )
  .mutation(async ({ input, ctx: { user } }) => {
    const {
      fileHash,
      apiKeyHash,
      workspaceId,
      fileName,
      fileSize,
      mimeType,
      analysisResult,
    } = input;

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

    try {
      await prisma.imageAnalysisCache.upsert({
        where: {
          fileHash,
        },
        update: {
          fileName,
          fileSize,
          mimeType,
          analysisResult,
          apiKey: apiKeyHash,
          updatedAt: new Date(),
        },
        create: {
          fileHash,
          fileName,
          fileSize,
          mimeType,
          workspaceId,
          analysisResult,
          apiKey: apiKeyHash,
        },
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to save cached analysis:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to save analysis cache",
      });
    }
  });
