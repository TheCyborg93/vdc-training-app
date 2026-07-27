CREATE TABLE "HomePlanLibraryMeta" (
  "planId" INTEGER NOT NULL,
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "folder" TEXT,
  "source" TEXT NOT NULL DEFAULT 'OWN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HomePlanLibraryMeta_pkey" PRIMARY KEY ("planId"),
  CONSTRAINT "HomePlanLibraryMeta_planId_fkey" FOREIGN KEY ("planId") REFERENCES "HomeTrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "HomePlanLibraryMeta_favorite_archived_idx" ON "HomePlanLibraryMeta"("favorite", "archived");
CREATE INDEX "HomePlanLibraryMeta_folder_idx" ON "HomePlanLibraryMeta"("folder");
