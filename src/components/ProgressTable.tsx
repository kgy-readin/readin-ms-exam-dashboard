import { Search, RotateCcw, Save, RefreshCcw } from "lucide-react";
import { StudentInfo, ProgressData } from "../types";

interface ProgressTableProps {
  isAdmin: boolean;
  adminViewStudent: StudentInfo | null;
  studentProgress: ProgressData[];
  validItemKeys: string[];
  itemKeys: string[];
  itemLabels: string[];
  pendingEdits: Record<string, number | string>;
  setPendingEdits: (edits: Record<string, number | string>) => void;
  isSaving: boolean;
  handleSaveEdits: () => void;
  handleEditChange: (unit: string, key: string, value: string) => void;
}

export const ProgressTable = ({
  isAdmin,
  adminViewStudent,
  studentProgress,
  validItemKeys,
  itemKeys,
  itemLabels,
  pendingEdits,
  setPendingEdits,
  isSaving,
  handleSaveEdits,
  handleEditChange
}: ProgressTableProps) => {
  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-[37px] h-[37px] bg-slate-50 rounded-xl flex items-center justify-center">
            <Search className="w-5 h-5 text-slate-600" />
          </div>
          <h3 className="text-[19px] font-semibold text-slate-900 font-paperlogy">
            {isAdmin && adminViewStudent && <span className="text-blue-600 mr-1 font-paperlogy">{adminViewStudent.name}</span>}
            단원별 한 눈에 보기
          </h3>
        </div>
        {isAdmin && Object.keys(pendingEdits).length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPendingEdits({})}
              disabled={isSaving}
              className="p-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
              title="수정 취소"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handleSaveEdits}
              disabled={isSaving}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>저장 ({Object.keys(pendingEdits).length})</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider font-suit">단원</th>
              {validItemKeys.map(key => {
                const labelIndex = itemKeys.indexOf(key);
                return (
                  <th key={key} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center font-suit">
                    {itemLabels[labelIndex]}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {studentProgress.map((p, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 font-semibold text-slate-700 whitespace-nowrap text-[14px] font-suit">{p.unit}</td>
                {validItemKeys.map(key => {
                  const val = p[key];
                  const editKey = `${adminViewStudent?.name}|${p.unit}|${key}`;
                  const isEdited = pendingEdits[editKey] !== undefined;
                  const displayVal = isEdited ? pendingEdits[editKey] : val;

                  if (isAdmin && adminViewStudent) {
                    return (
                      <td key={key} className="p-4 text-center">
                        <select
                          value={displayVal}
                          onChange={(e) => handleEditChange(p.unit, key, e.target.value)}
                          className={`w-[72px] px-1 py-1 text-center text-sm font-bold rounded-lg border transition-all focus:ring-2 focus:ring-indigo-200 outline-none appearance-none cursor-pointer ${
                            isEdited 
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                              : val === 100
                                ? "bg-green-50 border-green-200 text-green-700"
                                : typeof val === "number" && val > 0
                                  ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                  : val === "해당없음"
                                    ? "bg-slate-50 border-slate-200 text-slate-400"
                                    : "bg-slate-50 border-transparent text-slate-600 hover:border-slate-200"
                          }`}
                        >
                          <option value="해당없음">-</option>
                          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </td>
                    );
                  }

                  if (val === "해당없음") {
                    return (
                      <td key={key} className="p-4 text-center text-slate-400 font-medium">-</td>
                    );
                  }
                  
                  let label = "진행";
                  let colorClass = "bg-yellow-50 text-yellow-700";
                  if (typeof val === "number") {
                    if (val >= 100) {
                      label = "완료";
                      colorClass = "bg-green-50 text-green-700";
                    } else if (val <= 0) {
                      label = "예정";
                      colorClass = "bg-slate-100 text-slate-500";
                    }
                  }

                  return (
                    <td key={key} className="p-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-lg text-xs font-normal font-suit ${colorClass}`}>
                        {label}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Transposed Table */}
      <div className="md:hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 font-suit">항목</th>
              {studentProgress.map((p, idx) => (
                <th key={idx} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap w-[76px] min-w-[76px] font-suit">
                  {p.unit.length > 4 ? p.unit.substring(0, 4) : p.unit}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {validItemKeys.map((key) => {
              const labelIndex = itemKeys.indexOf(key);
              return (
                <tr key={key} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold text-slate-700 text-sm whitespace-nowrap sticky left-0 bg-white z-10 border-r border-slate-50 font-suit">
                    {itemLabels[labelIndex]}
                  </td>
                  {studentProgress.map((p, pIdx) => {
                    const val = p[key];
                    const editKey = `${adminViewStudent?.name}|${p.unit}|${key}`;
                    const isEdited = pendingEdits[editKey] !== undefined;
                    const displayVal = isEdited ? pendingEdits[editKey] : val;

                    if (isAdmin && adminViewStudent) {
                      return (
                        <td key={pIdx} className="p-4 text-center w-[76px] min-w-[76px]">
                          <select
                            value={displayVal}
                            onChange={(e) => handleEditChange(p.unit, key, e.target.value)}
                            className={`w-[56px] px-0.5 py-1 text-center text-[10px] font-bold rounded-lg border transition-all outline-none appearance-none cursor-pointer ${
                              isEdited 
                                ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                                : val === 100
                                  ? "bg-green-50 border-green-200 text-green-700"
                                  : typeof val === "number" && val > 0
                                    ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                    : val === "해당없음"
                                      ? "bg-slate-50 border-slate-200 text-slate-400"
                                      : "bg-slate-50 border-transparent text-slate-600"
                            }`}
                          >
                            <option value="해당없음">-</option>
                            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </td>
                      );
                    }

                    if (val === "해당없음") {
                      return (
                        <td key={pIdx} className="p-4 text-center text-slate-400 font-medium w-[76px] min-w-[76px]">-</td>
                      );
                    }

                    let label = "진행";
                    let colorClass = "bg-yellow-50 text-yellow-700";
                    if (typeof val === "number") {
                      if (val >= 100) {
                        label = "완료";
                        colorClass = "bg-green-50 text-green-700";
                      } else if (val <= 0) {
                        label = "예정";
                        colorClass = "bg-slate-100 text-slate-500";
                      }
                    }

                    return (
                      <td key={pIdx} className="p-4 text-center w-[76px] min-w-[76px]">
                        <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-normal font-suit ${colorClass}`}>
                          {label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
