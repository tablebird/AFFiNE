-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "ai_context_embeddings" (
    "id" VARCHAR NOT NULL,
    "context_id" VARCHAR NOT NULL,
    "file_id" VARCHAR NOT NULL,
    "chunk" INTEGER NOT NULL,
    "content" VARCHAR NOT NULL,
    "embedding" vector(512) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_context_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_workspace_embeddings" (
    "workspace_id" VARCHAR NOT NULL,
    "doc_id" VARCHAR NOT NULL,
    "chunk" INTEGER NOT NULL,
    "content" VARCHAR NOT NULL,
    "embedding" vector(512) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_workspace_embeddings_pkey" PRIMARY KEY ("workspace_id","doc_id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_context_embeddings_idx" ON ai_context_embeddings USING hnsw (embedding vector_cosine_ops);

-- CreateIndex
CREATE UNIQUE INDEX "ai_context_embeddings_context_id_file_id_chunk_key" ON "ai_context_embeddings"("context_id", "file_id", "chunk");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_workspace_embeddings_idx" ON ai_workspace_embeddings USING hnsw (embedding vector_cosine_ops);

-- AddForeignKey
ALTER TABLE "ai_context_embeddings" ADD CONSTRAINT "ai_context_embeddings_context_id_fkey" FOREIGN KEY ("context_id") REFERENCES "ai_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_workspace_embeddings" ADD CONSTRAINT "ai_workspace_embeddings_workspace_id_doc_id_fkey" FOREIGN KEY ("workspace_id", "doc_id") REFERENCES "snapshots"("workspace_id", "guid") ON DELETE CASCADE ON UPDATE CASCADE;
