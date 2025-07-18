-- CreateTable
CREATE TABLE "ImageAnalysisCache" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileHash" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "analysisResult" JSONB NOT NULL,
    "apiKey" TEXT NOT NULL,

    CONSTRAINT "ImageAnalysisCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImageAnalysisCache_fileHash_key" ON "ImageAnalysisCache"("fileHash");

-- CreateIndex
CREATE INDEX "ImageAnalysisCache_fileHash_idx" ON "ImageAnalysisCache"("fileHash");

-- CreateIndex
CREATE INDEX "ImageAnalysisCache_workspaceId_idx" ON "ImageAnalysisCache"("workspaceId");

-- AddForeignKey
ALTER TABLE "ImageAnalysisCache" ADD CONSTRAINT "ImageAnalysisCache_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE; 