import React, { useState } from 'react';
import {
  Download,
  FolderArchive,
  Terminal,
  Github,
  Check,
  Copy,
  X,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface ProjectDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProjectDownloadModal: React.FC<ProjectDownloadModalProps> = ({ isOpen, onClose }) => {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  if (!isOpen) return null;

  const terminalCommands = `# 1. Move to your Downloads folder
cd ~/Downloads

# 2. Clone the downloaded bundle into a new repository folder
git clone journal-nutrition.bundle journal-nutrition
cd journal-nutrition

# 3. Connect your GitHub repository
git remote set-url origin https://github.com/ParthibanRajasekaran/journal-nutrition.git

# 4. Push all branches, commits, iOS & Android projects to GitHub!
git push -u origin main`;

  const handleCopy = (text: string, stepIndex: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepIndex);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200 shadow-2xs">
              <Download className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                Direct Browser Download
              </span>
              <h3 className="font-editorial text-xl font-bold text-stone-900">
                Download Code & Push to GitHub
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Browser Authentication Explanation */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3 text-xs">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-emerald-950 space-y-1">
            <span className="font-semibold block">
              Why terminal <code className="bg-emerald-200/60 px-1 py-0.5 rounded font-mono text-[11px]">curl</code> redirected to Google:
            </span>
            <p className="text-[11px] text-emerald-900 leading-relaxed">
              Google Cloud requires an active browser session cookie. Downloading directly through these buttons in your browser uses your authenticated session and bypasses the login redirect!
            </p>
          </div>
        </div>

        {/* Step 1: Download Buttons */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block">
            Step 1: Download to your computer
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="/journal-nutrition.bundle"
              download="journal-nutrition.bundle"
              className="flex items-center justify-between p-4 rounded-2xl border-2 border-emerald-600 bg-emerald-50/50 hover:bg-emerald-100/60 transition-all text-xs font-medium text-emerald-950 shadow-xs group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FolderArchive className="w-5 h-5 text-emerald-700" />
                <div>
                  <span className="font-bold text-sm block text-emerald-900">Git Bundle (Recommended)</span>
                  <span className="text-[11px] text-stone-500 block">Preserves 100% git history (~0.9 MB)</span>
                </div>
              </div>
              <Download className="w-5 h-5 text-emerald-700 group-hover:translate-y-0.5 transition-transform" />
            </a>

            <a
              href="/journal-nutrition.tar.gz"
              download="journal-nutrition.tar.gz"
              className="flex items-center justify-between p-4 rounded-2xl border border-stone-200 bg-stone-50/70 hover:bg-stone-100 transition-all text-xs font-medium text-stone-900 shadow-xs group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FolderArchive className="w-5 h-5 text-stone-600" />
                <div>
                  <span className="font-bold text-sm block text-stone-900">Project Tarball</span>
                  <span className="text-[11px] text-stone-500 block">iOS, Android & Web source files</span>
                </div>
              </div>
              <Download className="w-5 h-5 text-stone-600 group-hover:translate-y-0.5 transition-transform" />
            </a>
          </div>
        </div>

        {/* Step 2: Push to GitHub */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 block">
              Step 2: Run in your computer's terminal to push
            </span>
            <button
              type="button"
              onClick={() => handleCopy(terminalCommands, 1)}
              className="inline-flex items-center gap-1 text-xs text-emerald-800 hover:text-emerald-950 font-medium cursor-pointer"
            >
              {copiedStep === 1 ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy All Commands</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-stone-900 rounded-2xl p-4 text-xs font-mono text-stone-200 overflow-x-auto leading-relaxed shadow-inner">
            <pre className="whitespace-pre">{terminalCommands}</pre>
          </div>
        </div>

        {/* Included Native Projects badge */}
        <div className="p-3 rounded-xl bg-stone-100 text-stone-600 text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            Includes native <strong className="text-stone-900">ios/</strong> (Xcode) and <strong className="text-stone-900">android/</strong> (Android Studio) projects
          </span>
          <a
            href="https://github.com/ParthibanRajasekaran/journal-nutrition"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-800 font-semibold hover:underline inline-flex items-center gap-1"
          >
            <span>Open GitHub Repo</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-stone-900 text-white font-medium text-xs hover:bg-stone-800 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};
