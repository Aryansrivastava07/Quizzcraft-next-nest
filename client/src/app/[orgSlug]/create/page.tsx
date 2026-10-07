"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import OrgWorkspaceGuard from "@/components/org/OrgWorkspaceGuard";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import { quizService } from "@/lib/api/quiz-service";
import { formatApiError } from "@/lib/api/client";
import { Organization } from "@/lib/api/types";

export default function OrgSlugCreateQuizPage() {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || "";

  return (
    <OrgWorkspaceGuard orgSlug={orgSlug}>
      {({ organization, isOrgAdmin, userRole }) => (
        <OrgCreateQuizContent
          organization={organization}
          orgSlug={orgSlug}
          isOrgAdmin={isOrgAdmin}
          userRole={userRole}
        />
      )}
    </OrgWorkspaceGuard>
  );
}

function OrgCreateQuizContent({
  organization,
  orgSlug,
  isOrgAdmin,
  userRole,
}: {
  organization: Organization;
  orgSlug: string;
  isOrgAdmin: boolean;
  userRole: string;
}) {
  const router = useRouter();

  type SourceType = "pdf" | "image" | "video" | "text" | "url";
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(["pdf", "text"]);
  const [topicPrompt, setTopicPrompt] = useState("");
  const [urlInput, setUrlInput] = useState("");

  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [quizType, setQuizType] = useState<"OBJECTIVE" | "TRUE_FALSE">("OBJECTIVE");

  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [createdQuizPayload, setCreatedQuizPayload] = useState<any | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (fileError) {
      const t = setTimeout(() => setFileError(null), 6000);
      return () => clearTimeout(t);
    }
  }, [fileError]);

  useEffect(() => {
    return () => {
      imageFiles.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [imageFiles]);

  const toggleSource = (type: SourceType) => {
    setSelectedSources((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== type);
      }
      return [...prev, type];
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePdfUpload = (files: FileList | File[]) => {
    setFileError(null);
    const validFiles: File[] = [];
    const maxPdfCount = 2;
    const maxPdfSize = 50 * 1024 * 1024;

    Array.from(files).forEach((file) => {
      const ext = file.name.toLowerCase();
      const isValidExt = ext.endsWith(".pdf") || ext.endsWith(".docx") || ext.endsWith(".txt");
      if (!isValidExt) {
        setFileError(`File "${file.name}" is not a supported document (.pdf, .docx, .txt).`);
        return;
      }
      if (file.size > maxPdfSize) {
        setFileError(`Document "${file.name}" exceeds the 50MB size limit.`);
        return;
      }
      validFiles.push(file);
    });

    setPdfFiles((prev) => {
      const combined = [...prev, ...validFiles];
      if (combined.length > maxPdfCount) {
        setFileError(`Maximum ${maxPdfCount} document files allowed.`);
        return combined.slice(0, maxPdfCount);
      }
      return combined;
    });
  };

  const handleImageUpload = (files: FileList | File[]) => {
    setFileError(null);
    const validImages: { file: File; preview: string }[] = [];
    const maxImgCount = 3;
    const maxImgSize = 20 * 1024 * 1024;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        setFileError(`File "${file.name}" is not a recognized image.`);
        return;
      }
      if (file.size > maxImgSize) {
        setFileError(`Image "${file.name}" exceeds the 20MB limit.`);
        return;
      }
      validImages.push({ file, preview: URL.createObjectURL(file) });
    });

    setImageFiles((prev) => {
      const combined = [...prev, ...validImages];
      if (combined.length > maxImgCount) {
        setFileError(`Maximum ${maxImgCount} images allowed.`);
        combined.slice(maxImgCount).forEach((i) => URL.revokeObjectURL(i.preview));
        return combined.slice(0, maxImgCount);
      }
      return combined;
    });
  };

  const handleVideoUpload = (files: FileList | File[]) => {
    setFileError(null);
    const file = Array.from(files)[0];
    if (!file) return;

    if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|avi|mkv)$/i.test(file.name)) {
      setFileError(`File "${file.name}" is not a recognized video file.`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setFileError(`Video "${file.name}" exceeds the 50MB limit.`);
      return;
    }
    setVideoFiles([file]);
  };

  const handleGenerateQuiz = async () => {
    setGenerateError(null);

    const realPdfs = selectedSources.includes("pdf") ? pdfFiles : [];
    const realImages = selectedSources.includes("image") ? imageFiles.map((item) => item.file) : [];
    const realVideos = selectedSources.includes("video") ? videoFiles : [];
    const realUrl = selectedSources.includes("url") ? urlInput.trim() : "";
    let promptText = selectedSources.includes("text") ? topicPrompt.trim() : "";

    const hasFiles = realPdfs.length > 0 || realImages.length > 0 || realVideos.length > 0;
    const hasUrl = Boolean(realUrl);
    const hasPrompt = Boolean(promptText);

    if (!hasPrompt && !hasFiles && !hasUrl) {
      setGenerateError("Please enter a topic prompt, attach a media file (PDF, Image, Video), or provide a web URL.");
      return;
    }

    if (!promptText) {
      const fileNames = [
        ...realPdfs.map((f) => f.name),
        ...realImages.map((f) => f.name),
        ...realVideos.map((f) => f.name),
      ];
      if (fileNames.length > 0) {
        promptText = `Generate a high-yield institutional assessment covering the key concepts from: ${fileNames.join(", ")}`;
      } else if (hasUrl) {
        promptText = `Generate a comprehensive educational assessment based on the content of: ${realUrl}`;
      }
    }

    setIsGenerating(true);
    setProgressStatus("Ingesting materials and synthesizing grounded questions with Gemini multimodal engine...");

    try {
      const response = await quizService.generateQuiz({
        prompt: promptText,
        questionCount,
        difficulty,
        quizType,
        sourceUrl: realUrl || undefined,
        images: realImages.length > 0 ? realImages : undefined,
        videos: realVideos.length > 0 ? realVideos : undefined,
        pdfs: realPdfs.length > 0 ? realPdfs : undefined,
      });

      if (response?.data?.quiz) {
        const quiz = response.data.quiz;
        localStorage.setItem("qc_active_quiz", JSON.stringify(quiz));
        setCreatedQuizPayload(quiz);
        setShowSuccessModal(true);
      } else {
        throw new Error("Backend response did not contain quiz payload");
      }
    } catch (err: any) {
      setGenerateError(formatApiError(err));
    } finally {
      setIsGenerating(false);
      setProgressStatus("");
    }
  };

  return (
    <div className="relative min-h-screen bg-surface text-on-surface overflow-x-hidden selection:bg-primary selection:text-white">
      <CosmicCanvas />
      <Navbar />

      <main className="relative z-10 pt-28 pb-20 px-4 sm:px-6 max-w-5xl mx-auto">
        <ParallaxReveal direction="up" distance={20}>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/${orgSlug}`}
                className="text-xs text-on-surface-variant hover:text-white transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>{organization.name} Portal</span>
              </Link>
              <span className="text-on-surface-variant text-xs">&bull;</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                /{organization.slug}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Create Organization Assessment
            </h1>
            <p className="text-on-surface-variant text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed">
              Synthesize grounded, anti-spoiler questions from documents, lecture slides, video lessons, or research papers.
              Assessments created here are automatically sandboxed for {organization.name}.
            </p>
          </div>

          {/* Error Message */}
          {generateError && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                <span>{generateError}</span>
              </div>
              <button onClick={() => setGenerateError(null)} className="text-xs hover:text-white cursor-pointer">✕</button>
            </div>
          )}

          {/* Main Card */}
          <div className="rounded-3xl bg-[#0b0e1b]/90 border border-white/10 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            {/* 1. Multi-source selector pills */}
            <div>
              <label className="text-xs font-semibold text-white block mb-2.5">
                Input Source Modalities
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "pdf" as const, label: "PDF / Documents", icon: "description" },
                  { id: "text" as const, label: "Curriculum Prompt", icon: "edit_note" },
                  { id: "image" as const, label: "Diagrams & Images", icon: "image" },
                  { id: "video" as const, label: "Lecture Video", icon: "movie" },
                  { id: "url" as const, label: "Web Article / Syllabus", icon: "link" },
                ].map((s) => {
                  const active = selectedSources.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSource(s.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                        active
                          ? "bg-primary/20 border-primary text-white shadow-md shadow-primary/20"
                          : "bg-white/[0.04] border-white/10 text-on-surface-variant hover:text-white hover:bg-white/[0.08]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{s.icon}</span>
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Document Upload Area */}
            {selectedSources.includes("pdf") && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">description</span>
                    Document Exhibit Ingestion (.pdf, .docx, .txt)
                  </span>
                  <span className="text-[11px] text-outline">Max 2 files, 50MB each</span>
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingPdf(true); }}
                  onDragLeave={() => setIsDraggingPdf(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDraggingPdf(false); handlePdfUpload(e.dataTransfer.files); }}
                  onClick={() => pdfInputRef.current?.click()}
                  className={`p-6 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors ${
                    isDraggingPdf ? "border-primary bg-primary/10" : "border-white/15 hover:border-white/30"
                  }`}
                >
                  <input
                    ref={pdfInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => e.target.files && handlePdfUpload(e.target.files)}
                    className="hidden"
                  />
                  <span className="material-symbols-outlined text-3xl text-outline">upload_file</span>
                  <p className="text-xs text-white mt-1">Click to browse or drop lecture notes / syllabus</p>
                </div>
                {pdfFiles.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {pdfFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.04] text-xs">
                        <span className="text-white truncate max-w-xs">{f.name} ({formatFileSize(f.size)})</span>
                        <button onClick={() => setPdfFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Prompt Area */}
            {selectedSources.includes("text") && (
              <div>
                <label className="text-xs font-semibold text-white block mb-1.5">
                  Curriculum Topic Prompt / Syllabus Directives
                </label>
                <textarea
                  rows={3}
                  value={topicPrompt}
                  onChange={(e) => setTopicPrompt(e.target.value)}
                  placeholder="e.g. Chapter 4: Microeconomic Market Equilibriums and Price Elasticity. Include high-order application problems."
                  className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-outline focus:border-primary outline-none transition-colors resize-none"
                />
              </div>
            )}

            {/* URL Input */}
            {selectedSources.includes("url") && (
              <div>
                <label className="text-xs font-semibold text-white block mb-1.5">
                  Web Resource / Article URL
                </label>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://en.wikipedia.org/wiki/Quantum_computing"
                  className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder:text-outline focus:border-primary outline-none transition-colors"
                />
              </div>
            )}

            {/* Image Upload Area */}
            {selectedSources.includes("image") && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-cyan-400">image</span>
                    Technical Diagrams &amp; Graphs (Max 3)
                  </span>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                  className="hidden"
                />
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="p-5 rounded-xl border-2 border-dashed border-white/15 hover:border-white/30 text-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-2xl text-outline">add_photo_alternate</span>
                  <p className="text-xs text-white mt-1">Attach circuit diagrams, charts, or specimen photos</p>
                </div>
                {imageFiles.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {imageFiles.map((item, i) => (
                      <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/20 shrink-0">
                        <img src={item.preview} alt="preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] flex items-center justify-center hover:bg-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Video Upload Area */}
            {selectedSources.includes("video") && (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5 mb-2">
                  <span className="material-symbols-outlined text-sm text-amber-400">movie</span>
                  Lecture Video Scene Anchor (Max 1 video, 50MB)
                </span>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => e.target.files && handleVideoUpload(e.target.files)}
                  className="hidden"
                />
                <div
                  onClick={() => videoInputRef.current?.click()}
                  className="p-5 rounded-xl border-2 border-dashed border-white/15 hover:border-white/30 text-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-2xl text-outline">video_file</span>
                  <p className="text-xs text-white mt-1">Upload lecture video clip</p>
                </div>
                {videoFiles.length > 0 && (
                  <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-white/[0.04] text-xs">
                    <span className="text-white truncate">{videoFiles[0].name} ({formatFileSize(videoFiles[0].size)})</span>
                    <button onClick={() => setVideoFiles([])} className="text-red-400">✕</button>
                  </div>
                )}
              </div>
            )}

            {/* Configurations: Count, Difficulty, Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/10">
              <div>
                <label className="text-xs font-semibold text-white block mb-1.5">Question Count</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white outline-none focus:border-primary"
                >
                  {[5, 10, 15, 20].map((n) => (
                    <option key={n} value={n} className="bg-surface text-white">{n} Questions</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white block mb-1.5">Difficulty Profile</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white outline-none focus:border-primary"
                >
                  <option value="EASY" className="bg-surface text-white">Foundational (Easy)</option>
                  <option value="MEDIUM" className="bg-surface text-white">Standard Collegiate (Medium)</option>
                  <option value="HARD" className="bg-surface text-white">Rigorous / Expert (Hard)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white block mb-1.5">Assessment Format</label>
                <select
                  value={quizType}
                  onChange={(e) => setQuizType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white outline-none focus:border-primary"
                >
                  <option value="OBJECTIVE" className="bg-surface text-white">Multiple Choice (4 Options)</option>
                  <option value="TRUE_FALSE" className="bg-surface text-white">True / False</option>
                </select>
              </div>
            </div>

            {/* Progress indicator */}
            {isGenerating && (
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-primary animate-spin">
                  progress_activity
                </span>
                <span className="text-xs text-white font-medium">{progressStatus}</span>
              </div>
            )}

            {/* Generate Action Button */}
            <div className="pt-4 flex items-center justify-end gap-3">
              <Link
                href={`/${orgSlug}`}
                className="px-5 py-2.5 rounded-xl text-xs text-on-surface-variant hover:text-white transition-colors"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleGenerateQuiz}
                disabled={isGenerating}
                className="px-6 py-2.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold transition-all shadow-lg shadow-primary-container/25 disabled:opacity-50 border border-white/10 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                <span>{isGenerating ? "Synthesizing..." : "Generate Institutional Quiz"}</span>
              </button>
            </div>
          </div>
        </ParallaxReveal>
      </main>

      {/* Success Modal */}
      {showSuccessModal && createdQuizPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-[#0b0e1b] border border-white/10 p-6 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">task_alt</span>
            </div>
            <h3 className="text-lg font-bold text-white">Quiz Generated Successfully!</h3>
            <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
              Your assessment <strong>"{createdQuizPayload.title}"</strong> ({createdQuizPayload.questions?.length || questionCount} questions)
              has been generated with multi-source visual anchors.
            </p>

            <div className="my-5 p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-mono text-outline">
              PIN: <strong className="text-white text-base tracking-widest">{createdQuizPayload.pin}</strong>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/deploy?quizId=${createdQuizPayload.quizId}`}
                className="w-full py-2.5 px-4 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white text-xs font-semibold transition-all shadow-md shadow-primary-container/25 border border-white/10 active:scale-95"
              >
                Deploy &amp; Schedule Mission
              </Link>
              <Link
                href={`/${orgSlug}/quizzes`}
                className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-semibold transition-all border border-white/10"
              >
                Back to Org Quizzes
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
