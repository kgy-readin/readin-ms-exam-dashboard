import { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Bell, Lock, Unlock, Edit2, Check, X, Loader2 } from "lucide-react";
import { StudentInfo } from "../types";

interface NoticeBannerProps {
  isAdmin: boolean;
  adminViewStudent: StudentInfo | null;
  currentViewStudent: StudentInfo | null;
  isNoticeExpanded: boolean;
  setIsNoticeExpanded: (val: boolean) => void;
  canExpandNotice: boolean;
  setCanExpandNotice: (val: boolean) => void;
  isEditingNotice: boolean;
  setIsEditingNotice: (val: boolean) => void;
  editNoticeText: string;
  setEditNoticeText: (val: string) => void;
  isUpdatingNotice: boolean;
  handleUpdateNotice: (text: string) => void;
  handleToggleNoticeLock: () => void;
}

export const NoticeBanner = ({
  isAdmin,
  adminViewStudent,
  currentViewStudent,
  isNoticeExpanded,
  setIsNoticeExpanded,
  canExpandNotice,
  setCanExpandNotice,
  isEditingNotice,
  setIsEditingNotice,
  editNoticeText,
  setEditNoticeText,
  isUpdatingNotice,
  handleUpdateNotice,
  handleToggleNoticeLock
}: NoticeBannerProps) => {
  const noticeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const checkTruncation = () => {
      if (noticeRef.current) {
        const isTruncated = noticeRef.current.scrollWidth > noticeRef.current.clientWidth;
        setCanExpandNotice(isTruncated);
        if (!isTruncated) setIsNoticeExpanded(false);
      }
    };
    const timer = setTimeout(checkTruncation, 100);
    return () => clearTimeout(timer);
  }, [currentViewStudent, adminViewStudent, setCanExpandNotice, setIsNoticeExpanded]);

  if (!isAdmin && currentViewStudent?.noticeHidden) return null;

  const getNoticeText = () => {
    let text = "";
    if (isAdmin) {
      if (!adminViewStudent) {
        text = "학생을 선택하여 공지사항을 확인하세요.";
      } else {
        text = (adminViewStudent.notice || "공지사항이 없습니다.").replace(/\{\{name\}\}/g, adminViewStudent.name);
      }
    } else {
      text = (currentViewStudent?.notice || "공지사항이 없습니다.").replace(/\{\{name\}\}/g, currentViewStudent?.name || "");
    }
    return text;
  };

  const noticeText = getNoticeText();
  const match = noticeText.match(/^\[(.*?)\](.*)$/);
  const tag = match ? match[1] : null;
  const content = match ? match[2].trim() : noticeText;

  return (
    <motion.div 
      layout
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('textarea')) return;
        if (canExpandNotice || isNoticeExpanded) {
          setIsNoticeExpanded(!isNoticeExpanded);
        }
      }}
      className={`bg-white px-6 rounded-2xl shadow-sm border border-slate-100 overflow-hidden w-full ${isNoticeExpanded ? "py-5" : "h-[52px] flex items-center"} ${(canExpandNotice || isNoticeExpanded) ? "cursor-pointer hover:bg-slate-50" : "cursor-default"}`}
    >
      <div className={`flex flex-col w-full ${isNoticeExpanded ? "gap-3" : ""}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center shrink-0">
            <Bell className="w-[17px] h-[17px] text-[#f63b7b] fill-[#f63b7b]" />
          </div>
          <div className="font-bold text-slate-700 flex items-center gap-2 font-suit min-w-0 flex-1">
            {tag && (
              <span className="bg-[#fff1f4] text-[#f62468] px-2 pt-[2px] pb-[2px] rounded-lg text-[13px] font-extrabold shrink-0 font-suit">
                {tag}
              </span>
            )}
            {!isNoticeExpanded && (
              <span 
                ref={noticeRef}
                className="truncate text-[15px] font-suit font-normal flex-1 min-w-0"
              >
                {content}
              </span>
            )}
          </div>

          {isAdmin && adminViewStudent && (
            <div className="flex items-center gap-2 shrink-0 ml-2 md:ml-4">
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleNoticeLock(); }}
                disabled={isUpdatingNotice}
                className={`p-2 rounded-lg transition-colors ${adminViewStudent.noticeHidden ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}
                title={adminViewStudent.noticeHidden ? "공지사항 숨김 해제" : "공지사항 숨기기"}
              >
                {isUpdatingNotice ? <Loader2 className="w-4 h-4 animate-spin" /> : adminViewStudent.noticeHidden ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditingNotice) {
                    handleUpdateNotice(editNoticeText);
                  } else {
                    setEditNoticeText(adminViewStudent.notice || "");
                    setIsEditingNotice(true);
                    setIsNoticeExpanded(true);
                  }
                }}
                disabled={isUpdatingNotice}
                className={`rounded-lg text-sm font-bold transition-colors flex items-center justify-center ${isEditingNotice ? "px-3 py-1.5 gap-1.5 bg-blue-600 text-white hover:bg-blue-700" : "p-2 bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
              >
                {isUpdatingNotice ? <Loader2 className="w-4 h-4 animate-spin" /> : isEditingNotice ? <><Check className="w-4 h-4" /><span>저장</span></> : <Edit2 className="w-4 h-4" />}
              </button>
              {isEditingNotice && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditingNotice(false); }}
                  className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {isNoticeExpanded && (
          <div className="text-[15px] font-suit font-normal text-slate-700 whitespace-pre-wrap leading-relaxed w-full">
            {isEditingNotice ? (
              <textarea
                value={editNoticeText}
                onChange={(e) => setEditNoticeText(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] font-suit text-[15px]"
                placeholder="공지사항을 입력하세요... ({{name}} 사용 가능)"
                autoFocus
              />
            ) : (
              content
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
