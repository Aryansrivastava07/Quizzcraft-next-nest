"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import CosmicCanvas from "@/components/canvas/CosmicCanvas";
import Navbar from "@/components/layout/Navbar";
import ParallaxReveal from "@/components/ui/ParallaxReveal";
import { quizService } from "@/lib/api/quiz-service";
import { formatApiError } from "@/lib/api/client";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

function CreateQuizContent() {
  const router = useRouter();

  // Multi-select input sources
  type SourceType = "pdf" | "image" | "video" | "text" | "url";
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(["pdf", "text"]);
  const [topicPrompt, setTopicPrompt] = useState("");
  const [urlInput, setUrlInput] = useState("");

  // Real uploaded file state
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string }[]>([]);
  const [videoFiles, setVideoFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // Drag over states
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);

  // Hidden file input references
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss file errors
  useEffect(() => {
    if (fileError) {
      const t = setTimeout(() => setFileError(null), 6000);
      return () => clearTimeout(t);
    }
  }, [fileError]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      imageFiles.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, [imageFiles]);

  const toggleSource = (type: SourceType) => {
    setSelectedSources((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // Keep at least one source active
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

  // PDF Handlers (Max 2 files, up to 50MB each)
  const handlePdfUpload = (files: FileList | File[]) => {
    setFileError(null);
    const validFiles: File[] = [];
    const maxPdfCount = 2;
    const maxPdfSize = 50 * 1024 * 1024; // 50MB

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
        setFileError(`Maximum ${maxPdfCount} document files allowed. Only the first ${maxPdfCount} were retained.`);
        return combined.slice(0, maxPdfCount);
      }
      return combined;
    });
  };

  const handleRemovePdf = (index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Image Handlers (Max 5 images, up to 20MB each)
  const handleImageUpload = (files: FileList | File[]) => {
    setFileError(null);
    const validImages: { file: File; preview: string }[] = [];
    const maxImgCount = 5;
    const maxImgSize = 20 * 1024 * 1024; // 20MB

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        setFileError(`File "${file.name}" is not a recognized image.`);
        return;
      }
      if (file.size > maxImgSize) {
        setFileError(`Image "${file.name}" exceeds the 20MB limit.`);
        return;
      }
      const preview = URL.createObjectURL(file);
      validImages.push({ file, preview });
    });

    setImageFiles((prev) => {
      const combined = [...prev, ...validImages];
      if (combined.length > maxImgCount) {
        setFileError(`Maximum ${maxImgCount} images allowed. Only the first ${maxImgCount} were kept.`);
        combined.slice(maxImgCount).forEach((item) => URL.revokeObjectURL(item.preview));
        return combined.slice(0, maxImgCount);
      }
      return combined;
    });
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => {
      const target = prev[index];
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Video Handlers (Max 1 video, up to 50MB)
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

  const handleRemoveVideo = () => {
    setVideoFiles([]);
  };

  // Quiz preferences
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [quizType, setQuizType] = useState("Multiple Choice");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Post-Creation Mission Popup State
  const [createdQuizPayload, setCreatedQuizPayload] = useState<any>(null);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [missionChoice, setMissionChoice] = useState<"practice" | "host">("practice");
  const [postPublicForLeaderboard, setPostPublicForLeaderboard] = useState(true);
  const [isStartingPractice, setIsStartingPractice] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerateError(null);
    setIsGenerating(true);
    setProgressStatus("Dispatching quiz generation to backend Gemini engine...");

    const realPdfs = selectedSources.includes("pdf") ? pdfFiles : [];
    const realImages = selectedSources.includes("image") ? imageFiles.map((i) => i.file) : [];
    const realVideos = selectedSources.includes("video") ? videoFiles : [];

    let promptText = topicPrompt.trim();
    if (!promptText) {
      const fileNames = [
        ...realPdfs.map((f) => f.name),
        ...realImages.map((f) => f.name),
        ...realVideos.map((f) => f.name),
      ];
      if (fileNames.length > 0) {
        promptText = `Generate a high-yield, comprehensive educational quiz covering the key concepts and facts from: ${fileNames.join(", ")}`;
      } else if (selectedSources.includes("url") && urlInput.trim()) {
        promptText = `Generate a quiz based on content from: ${urlInput.trim()}`;
      } else {
        promptText = "Quantum Physics Foundations and Applied Science";
      }
    }

    try {
      const response = await quizService.generateQuiz({
        prompt: promptText,
        questionCount,
        difficulty,
        quizType,
        sourceUrl: selectedSources.includes("url") && urlInput.trim() ? urlInput.trim() : undefined,
        images: realImages.length > 0 ? realImages : undefined,
        videos: realVideos.length > 0 ? realVideos : undefined,
        pdfs: realPdfs.length > 0 ? realPdfs : undefined,
      });

      if (response?.data?.quiz) {
        const quiz = response.data.quiz;
        localStorage.setItem("qc_active_quiz", JSON.stringify(quiz));
        setCreatedQuizPayload(quiz);
        setShowMissionModal(true);
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

  const handleStartPractice = async () => {
    if (!createdQuizPayload) return;
    setIsStartingPractice(true);
    try {
      if (postPublicForLeaderboard) {
        await quizService.deployQuiz(createdQuizPayload.quizId, {
          deploymentType: "ANYTIME",
          accessMode: "PUBLIC",
          isPractice: true,
        });
      }
    } catch (e) {
      console.warn("Could not pre-deploy practice quiz:", e);
    }
    const cleanPin = createdQuizPayload.pin ? createdQuizPayload.pin.replace(/\D/g, "") : "";
    router.push(`/quiz?quizId=${encodeURIComponent(createdQuizPayload.quizId)}&pin=${cleanPin}&practice=true`);
  };

  const handleProceedToDeploy = () => {
    if (!createdQuizPayload) return;
    router.push(`/deploy?quizId=${encodeURIComponent(createdQuizPayload.quizId)}`);
  };

  return (
    <main className="min-h-screen relative overflow-x-hidden flex flex-col justify-between">
      {/* Universal Cosmic Starfield Canvas */}
      <CosmicCanvas />

      {/* Universal Top Navbar */}
      <Navbar />

      {/* Main Creation Flow */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-28 pb-16 w-full">
        {/* Header */}
        <ParallaxReveal direction="up" distance={20} duration={650}>
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high/80 border border-primary/30 text-tertiary font-headline-sm text-xs mb-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
              <span>AI QUIZ BUILDER</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-headline-xl font-bold text-white tracking-tight">
              Create Your Quiz in Seconds
            </h1>
            <p className="text-body-md text-sm text-on-surface-variant mt-2">
              Upload notes or enter a topic. Our AI transforms it into an interactive 3D quiz.
            </p>
          </div>
        </ParallaxReveal>

        {/* Builder Container Card */}
        <ParallaxReveal direction="up" distance={30} delay={100} duration={750}>
          <form
            onSubmit={handleGenerate}
            className="rounded-2xl glass-kage border border-white/10 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-6"
          >
          {/* Step 1: Multi-Select Input Sources */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="block text-xs font-headline-sm font-semibold uppercase tracking-wider text-tertiary">
                1. Choose Input Sources (Multi-Select Enabled)
              </label>
              <span className="text-[11px] font-label-code text-on-surface-variant">
                Select one or multiple sources to combine
              </span>
            </div>

            {/* 5 Multi-Select Source Options */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Option 1: PDF / Documents */}
              <button
                type="button"
                onClick={() => toggleSource("pdf")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all cursor-pointer relative ${
                  selectedSources.includes("pdf")
                    ? "bg-primary-container/20 border-primary text-white shadow-md shadow-primary/20"
                    : "bg-surface-container/50 border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="material-symbols-outlined text-2xl text-primary">
                    picture_as_pdf
                  </span>
                  <span
                    className={`min-w-4 h-4 px-1 rounded-md flex items-center justify-center border text-[10px] ${
                      selectedSources.includes("pdf")
                        ? "bg-primary text-on-primary border-primary font-bold"
                        : "border-outline-variant/60"
                    }`}
                  >
                    {selectedSources.includes("pdf") ? (pdfFiles.length > 0 ? pdfFiles.length : "✓") : ""}
                  </span>
                </div>
                <div className="text-left w-full">
                  <span className="text-xs font-semibold block">PDF / Notes</span>
                  <span className="text-[10px] text-on-surface-variant">
                    {pdfFiles.length > 0 ? `${pdfFiles.length} file${pdfFiles.length > 1 ? "s" : ""}` : "Syllabi, PDFs, TXT"}
                  </span>
                </div>
              </button>

              {/* Option 2: Images & Diagrams */}
              <button
                type="button"
                onClick={() => toggleSource("image")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all cursor-pointer relative ${
                  selectedSources.includes("image")
                    ? "bg-primary-container/20 border-primary text-white shadow-md shadow-primary/20"
                    : "bg-surface-container/50 border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="material-symbols-outlined text-2xl text-tertiary">
                    image
                  </span>
                  <span
                    className={`min-w-4 h-4 px-1 rounded-md flex items-center justify-center border text-[10px] ${
                      selectedSources.includes("image")
                        ? "bg-primary text-on-primary border-primary font-bold"
                        : "border-outline-variant/60"
                    }`}
                  >
                    {selectedSources.includes("image") ? (imageFiles.length > 0 ? imageFiles.length : "✓") : ""}
                  </span>
                </div>
                <div className="text-left w-full">
                  <span className="text-xs font-semibold block">Images &amp; Diagrams</span>
                  <span className="text-[10px] text-on-surface-variant">
                    {imageFiles.length > 0 ? `${imageFiles.length} attached` : "Formulas, charts"}
                  </span>
                </div>
              </button>

              {/* Option 3: Video Lecture */}
              <button
                type="button"
                onClick={() => toggleSource("video")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all cursor-pointer relative ${
                  selectedSources.includes("video")
                    ? "bg-primary-container/20 border-primary text-white shadow-md shadow-primary/20"
                    : "bg-surface-container/50 border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="material-symbols-outlined text-2xl text-violet-400">
                    video_library
                  </span>
                  <span
                    className={`min-w-4 h-4 px-1 rounded-md flex items-center justify-center border text-[10px] ${
                      selectedSources.includes("video")
                        ? "bg-primary text-on-primary border-primary font-bold"
                        : "border-outline-variant/60"
                    }`}
                  >
                    {selectedSources.includes("video") ? (videoFiles.length > 0 ? "1" : "✓") : ""}
                  </span>
                </div>
                <div className="text-left w-full">
                  <span className="text-xs font-semibold block">Video Lecture</span>
                  <span className="text-[10px] text-on-surface-variant">
                    {videoFiles.length > 0 ? "1 video ready" : "MP4, WebM clip"}
                  </span>
                </div>
              </button>

              {/* Option 4: Topic / Prompt */}
              <button
                type="button"
                onClick={() => toggleSource("text")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all cursor-pointer relative ${
                  selectedSources.includes("text")
                    ? "bg-primary-container/20 border-primary text-white shadow-md shadow-primary/20"
                    : "bg-surface-container/50 border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="material-symbols-outlined text-2xl text-secondary">
                    edit_note
                  </span>
                  <span
                    className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] ${
                      selectedSources.includes("text")
                        ? "bg-primary text-on-primary border-primary font-bold"
                        : "border-outline-variant/60"
                    }`}
                  >
                    {selectedSources.includes("text") && "✓"}
                  </span>
                </div>
                <div className="text-left w-full">
                  <span className="text-xs font-semibold block">Topic / Prompt</span>
                  <span className="text-[10px] text-on-surface-variant">Instructions</span>
                </div>
              </button>

              {/* Option 5: Web / URL */}
              <button
                type="button"
                onClick={() => toggleSource("url")}
                className={`p-3.5 rounded-xl border flex flex-col items-center gap-2 text-center transition-all cursor-pointer relative ${
                  selectedSources.includes("url")
                    ? "bg-primary-container/20 border-primary text-white shadow-md shadow-primary/20"
                    : "bg-surface-container/50 border-outline-variant/30 text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="material-symbols-outlined text-2xl text-amber-accent">
                    link
                  </span>
                  <span
                    className={`w-4 h-4 rounded-md flex items-center justify-center border text-[10px] ${
                      selectedSources.includes("url")
                        ? "bg-primary text-on-primary border-primary font-bold"
                        : "border-outline-variant/60"
                    }`}
                  >
                    {selectedSources.includes("url") && "✓"}
                  </span>
                </div>
                <div className="text-left w-full">
                  <span className="text-xs font-semibold block">Web / URL</span>
                  <span className="text-[10px] text-on-surface-variant">URLs, links</span>
                </div>
              </button>
            </div>

            {/* File Error Alert */}
            {fileError && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-amber-400">
                    warning
                  </span>
                  <span>{fileError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFileError(null)}
                  className="p-1 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}

            {/* Active Sources Input Panels */}
            <div className="space-y-4 pt-2">
              {/* PDF Documents Depot */}
              {selectedSources.includes("pdf") && (
                <div className="p-5 rounded-2xl bg-surface-container/40 border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary">
                        description
                      </span>
                      Document &amp; Lecture Slides Depot
                      <span className="font-label-code text-[11px] text-on-surface-variant ml-1 font-normal">
                        ({pdfFiles.length}/2 documents)
                      </span>
                    </span>

                    {pdfFiles.length < 2 && (
                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        className="text-[11px] text-primary hover:underline font-label-code flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>Browse Documents</span>
                      </button>
                    )}
                  </div>

                  {/* Hidden Input */}
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handlePdfUpload(e.target.files)}
                  />

                  {/* Drag and Drop Zone */}
                  <div
                    onClick={() => pdfInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingPdf(false);
                      if (e.dataTransfer.files) handlePdfUpload(e.dataTransfer.files);
                    }}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all group ${
                      isDraggingPdf
                        ? "border-primary bg-primary/10 shadow-lg"
                        : "border-outline-variant/50 hover:border-primary/60 bg-surface-container-low/40 hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl text-primary group-hover:scale-110 transition-transform">
                      cloud_upload
                    </span>
                    <p className="text-xs font-medium text-on-surface mt-1.5">
                      Drop lecture notes, PDF, or syllabus here, or click to browse
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Supports PDF, DOCX, TXT up to 50MB per file (max 2 files)
                    </p>
                  </div>

                  {/* Real Uploaded PDF Files List */}
                  {pdfFiles.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {pdfFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 gap-3"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-9 h-9 rounded-lg bg-primary-container/20 border border-primary/30 flex items-center justify-center shrink-0 text-primary">
                              <span className="material-symbols-outlined text-lg">
                                picture_as_pdf
                              </span>
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-medium text-white truncate max-w-sm">
                                {file.name}
                              </p>
                              <span className="text-[10px] text-on-surface-variant font-label-code">
                                {formatFileSize(file.size)} • Ready for AI extraction
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePdf(idx);
                            }}
                            className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-error transition-colors shrink-0 cursor-pointer"
                            title="Remove document"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Images & Diagrams Station */}
              {selectedSources.includes("image") && (
                <div className="p-5 rounded-2xl bg-surface-container/40 border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-tertiary">
                        image
                      </span>
                      Images, Formulas &amp; Diagrams
                      <span className="font-label-code text-[11px] text-on-surface-variant ml-1 font-normal">
                        ({imageFiles.length}/5 images)
                      </span>
                    </span>

                    {imageFiles.length < 5 && (
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="text-[11px] text-tertiary hover:underline font-label-code flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>Browse Images</span>
                      </button>
                    )}
                  </div>

                  {/* Hidden Input */}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
                  />

                  {/* Drag and Drop Zone */}
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingImage(false);
                      if (e.dataTransfer.files) handleImageUpload(e.dataTransfer.files);
                    }}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all group ${
                      isDraggingImage
                        ? "border-tertiary bg-tertiary/10 shadow-lg"
                        : "border-outline-variant/50 hover:border-tertiary/60 bg-surface-container-low/40 hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl text-tertiary group-hover:scale-110 transition-transform">
                      add_photo_alternate
                    </span>
                    <p className="text-xs font-medium text-on-surface mt-1.5">
                      Drop whiteboard photos, formula sheets, or diagrams here, or click to browse
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Supports PNG, JPG, JPEG, WEBP up to 20MB per image (max 5 images)
                    </p>
                  </div>

                  {/* Real Uploaded Images Previews */}
                  {imageFiles.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {imageFiles.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/40 gap-3"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-outline-variant/30 bg-surface-container-lowest">
                              <img
                                src={item.preview}
                                alt={item.file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-medium text-white truncate max-w-xs">
                                {item.file.name}
                              </p>
                              <span className="text-[10px] text-on-surface-variant font-label-code">
                                {formatFileSize(item.file.size)} • Ready for OCR / Vision
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(idx);
                            }}
                            className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-error transition-colors shrink-0 cursor-pointer"
                            title="Remove image"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Video Lecture Depot */}
              {selectedSources.includes("video") && (
                <div className="p-5 rounded-2xl bg-surface-container/40 border border-outline-variant/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-violet-400">
                        video_library
                      </span>
                      Video Lecture &amp; Recording Depot
                      <span className="font-label-code text-[11px] text-on-surface-variant ml-1 font-normal">
                        ({videoFiles.length}/1 video)
                      </span>
                    </span>

                    {videoFiles.length === 0 && (
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        className="text-[11px] text-violet-400 hover:underline font-label-code flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>Browse Video</span>
                      </button>
                    )}
                  </div>

                  {/* Hidden Input */}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                    className="hidden"
                    onChange={(e) => e.target.files && handleVideoUpload(e.target.files)}
                  />

                  {/* Drag and Drop Zone */}
                  <div
                    onClick={() => videoInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingVideo(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDraggingVideo(false);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingVideo(false);
                      if (e.dataTransfer.files) handleVideoUpload(e.dataTransfer.files);
                    }}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all group ${
                      isDraggingVideo
                        ? "border-violet-400 bg-violet-500/10 shadow-lg"
                        : "border-outline-variant/50 hover:border-violet-400/60 bg-surface-container-low/40 hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl text-violet-400 group-hover:scale-110 transition-transform">
                      movie
                    </span>
                    <p className="text-xs font-medium text-on-surface mt-1.5">
                      Drop recorded lecture or video explanation clip here, or click to browse
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Supports MP4, WebM, MOV, AVI up to 50MB (max 1 video)
                    </p>
                  </div>

                  {/* Real Uploaded Video File */}
                  {videoFiles.length > 0 && (
                    <div className="space-y-2 pt-1">
                      {videoFiles.map((file, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/40 gap-3"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 text-violet-400">
                              <span className="material-symbols-outlined text-xl">
                                play_circle
                              </span>
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-medium text-white truncate max-w-sm">
                                {file.name}
                              </p>
                              <span className="text-[10px] text-on-surface-variant font-label-code">
                                {formatFileSize(file.size)} • Multi-modal Gemini Video Analysis
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveVideo();
                            }}
                            className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-error transition-colors shrink-0 cursor-pointer"
                            title="Remove video"
                          >
                            <span className="material-symbols-outlined text-base">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Topic / Prompt */}
              {selectedSources.includes("text") && (
                <div className="p-5 rounded-2xl bg-surface-container/40 border border-outline-variant/30 space-y-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-secondary">
                      edit_note
                    </span>
                    Topic, Concepts &amp; Custom Instructions
                  </span>
                  <textarea
                    rows={3}
                    value={topicPrompt}
                    onChange={(e) => setTopicPrompt(e.target.value)}
                    placeholder="e.g. Generate a high-rigor quiz about Quantum Entanglement and Bell's Theorem for graduate physics students with emphasis on Bloch sphere mechanics..."
                    className="w-full p-3.5 rounded-xl bg-surface-container-low/80 border border-outline-variant/40 text-on-surface placeholder:text-outline text-xs focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>
              )}

              {/* Web / URL */}
              {selectedSources.includes("url") && (
                <div className="p-5 rounded-2xl bg-surface-container/40 border border-outline-variant/30 space-y-2">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-accent">
                      link
                    </span>
                    Web Article or YouTube Video URL
                  </span>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://en.wikipedia.org/wiki/Quantum_computing or YouTube lecture URL..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low/80 border border-outline-variant/40 text-on-surface placeholder:text-outline text-xs focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Quiz Configuration (Spacious & Clean) */}
          <div className="pt-6 border-t border-outline-variant/20 space-y-4">
            <label className="block text-xs font-headline-sm font-semibold uppercase tracking-wider text-tertiary">
              2. Quiz Preferences
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Question Count */}
              <div>
                <label className="block text-xs text-on-surface-variant mb-2">
                  Questions: <strong className="text-white">{questionCount}</strong>
                </label>
                <div className="flex gap-1.5">
                  {[5, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        questionCount === num
                          ? "bg-primary text-on-primary border-primary shadow-sm"
                          : "bg-surface-container/40 border-outline-variant/30 text-on-surface-variant hover:text-white"
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <label className="block text-xs text-on-surface-variant mb-2">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Beginner">Beginner (Foundational)</option>
                  <option value="Intermediate">Intermediate (Standard)</option>
                  <option value="Advanced">Advanced (High Rigor)</option>
                  <option value="Adaptive AI">Adaptive AI (Auto-Scale)</option>
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="block text-xs text-on-surface-variant mb-2">
                  Question Format
                </label>
                <select
                  value={quizType}
                  onChange={(e) => setQuizType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container/60 border border-outline-variant/40 text-on-surface text-xs focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Multiple Choice">Multiple Choice (4 Options)</option>
                  <option value="True / False">True / False Blitz</option>
                  <option value="Mixed Format">Mixed Format</option>
                </select>
              </div>
            </div>
          </div>

          {/* Backend Error Banner */}
          {generateError && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-start gap-3 animate-fadeIn">
              <span className="material-symbols-outlined text-red-400 text-xl shrink-0 mt-0.5">
                error
              </span>
              <div className="flex-1">
                <p className="font-semibold text-red-200 text-sm">Quiz Generation Failed (Backend Error)</p>
                <p className="mt-1 opacity-90 leading-relaxed break-words">{generateError}</p>
                <p className="mt-2 text-[11px] text-red-400/80 font-mono">
                  Target Endpoint: POST http://localhost:5000/api/quiz/generate
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Action & Generation (Mature Solid Single Color Button) */}
          <div className="pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-tertiary">
                check_circle
              </span>
              <span>
                Ready to synthesize {questionCount} questions across{" "}
                <strong className="text-white font-medium">
                  {selectedSources.length} source{selectedSources.length > 1 ? "s" : ""}
                </strong>
              </span>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-primary-container hover:bg-primary-container/90 text-white font-headline-sm text-xs font-semibold shadow-sm border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">
                    progress_activity
                  </span>
                  <span>{progressStatus || "Generating Quiz..."}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">bolt</span>
                  <span>Generate Interactive Quiz</span>
                </>
              )}
            </button>
          </div>
        </form>
        </ParallaxReveal>
      </div>

      {/* Post-Creation Mission Popup Modal */}
      {showMissionModal && createdQuizPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl rounded-2xl glass-kage border border-primary/40 p-6 sm:p-8 shadow-2xl space-y-6 overflow-hidden bg-[#0c1020]">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-tertiary to-amber-accent" />
            <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-primary/20 blur-[80px] pointer-events-none" />

            {/* Modal Header */}
            <div className="space-y-1.5 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/40 font-label-code text-[11px] font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span>AI Synthesis Complete</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-headline-xl font-bold text-white tracking-tight">
                What is your mission for this quiz?
              </h2>
              <p className="text-on-surface-variant font-body-md text-xs sm:text-sm line-clamp-1">
                "{createdQuizPayload.title}" • {createdQuizPayload.questions?.length || questionCount} Questions
              </p>
            </div>

            {/* Mission Choice Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Solo Practice */}
              <button
                type="button"
                onClick={() => setMissionChoice("practice")}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                  missionChoice === "practice"
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                    : "border-outline-variant/30 bg-surface-container/50 hover:border-outline-variant/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="material-symbols-outlined text-2xl text-primary">
                    psychology
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      missionChoice === "practice"
                        ? "border-primary bg-primary"
                        : "border-outline-variant"
                    }`}
                  >
                    {missionChoice === "practice" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-headline-sm text-sm font-bold text-white">
                    Solo Practice Mode
                  </h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                    Take the quiz yourself immediately without revealing answers.
                  </p>
                </div>
              </button>

              {/* Option 2: Host for Others */}
              <button
                type="button"
                onClick={() => setMissionChoice("host")}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                  missionChoice === "host"
                    ? "border-tertiary bg-tertiary/10 shadow-lg shadow-tertiary/20"
                    : "border-outline-variant/30 bg-surface-container/50 hover:border-outline-variant/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="material-symbols-outlined text-2xl text-tertiary">
                    groups
                  </span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      missionChoice === "host"
                        ? "border-tertiary bg-tertiary"
                        : "border-outline-variant"
                    }`}
                  >
                    {missionChoice === "host" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="font-headline-sm text-sm font-bold text-white">
                    Host / Deploy Room
                  </h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                    Deploy real-time live host lobby, schedule, or invite others via PIN.
                  </p>
                </div>
              </button>
            </div>

            {/* Dynamic Content Based on Choice */}
            {missionChoice === "practice" ? (
              <div className="space-y-4 pt-1">
                {/* Public Leaderboard Preview Checkbox */}
                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-container/70 border border-outline-variant/30 cursor-pointer hover:border-primary/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={postPublicForLeaderboard}
                    onChange={(e) => setPostPublicForLeaderboard(e.target.checked)}
                    className="mt-0.5 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary w-4 h-4"
                  />
                  <div className="space-y-0.5">
                    <span className="block text-xs font-semibold text-white">
                      Also post this quiz to public leaderboard
                    </span>
                    <span className="block text-[11px] text-on-surface-variant leading-relaxed">
                      Allows other cadets to attempt this quiz and unlocks a real-time leaderboard preview so you can benchmark your score against community peers.
                    </span>
                  </div>
                </label>

                {/* Instant Start Button (Bypasses quiz data viewing) */}
                <button
                  type="button"
                  disabled={isStartingPractice}
                  onClick={handleStartPractice}
                  className="w-full py-3.5 px-5 rounded-xl bg-primary hover:bg-primary/90 text-surface-container-lowest font-headline-sm font-bold text-sm shadow-xl shadow-primary/25 hover:shadow-primary/40 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">play_arrow</span>
                  <span>{isStartingPractice ? "Launching Practice..." : "Start Quiz Right Away 🚀"}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 pt-1">
                <div className="p-3.5 rounded-xl bg-surface-container/70 border border-outline-variant/30 space-y-1 text-xs">
                  <span className="block font-semibold text-white">
                    Deployment Command Center:
                  </span>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Set up Public, Private, or Organization-restricted access, select a live telemetry duration, or schedule a timed launch with automated email notifications.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleProceedToDeploy}
                  className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-primary-container via-secondary-container to-tertiary hover:opacity-95 text-white font-headline-sm font-bold text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">settings_suggest</span>
                  <span>Proceed to Deployment Hub ⚙️</span>
                </button>
              </div>
            )}

            {/* Subtle Studio Editor Link */}
            <div className="pt-2 text-center border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => router.push(`/editor?quizId=${encodeURIComponent(createdQuizPayload.quizId)}`)}
                className="text-[11px] font-label-code text-on-surface-variant hover:text-white transition-colors underline"
              >
                Or review & edit questions in Studio first →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-on-surface-variant border-t border-outline-variant/20 backdrop-blur-md">
        © 2026 QuizzCraft.app • Interactive 3D Learning Platform
      </footer>
    </main>
  );
}

export default function CreateQuizPage() {
  return (
    <ProtectedRoute>
      <CreateQuizContent />
    </ProtectedRoute>
  );
}
