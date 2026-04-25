import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  AnimatePresence,
  motion
} from "motion/react";
import { 
  Loader2,
  AlertCircle,
  User
} from "lucide-react";
import Papa from "papaparse";
import { 
  StudentInfo, 
  ProgressData
} from "./types";
import { SPREADSHEET_ID, GAS_WEBAPP_URL, APP_VERSION } from "./constants";

// Extracted Components
import { Toast } from "./components/Toast";
import { LoginView } from "./components/LoginView";
import { NoticeBanner } from "./components/NoticeBanner";
import { DashboardHeader } from "./components/DashboardHeader";
import { StatsCards } from "./components/StatsCards";
import { ProgressCharts } from "./components/ProgressCharts";
import { ProgressTable } from "./components/ProgressTable";

export default function App() {
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [allProgress, setAllProgress] = useState<ProgressData[]>([]);
  const [itemLabels, setItemLabels] = useState<string[]>([]);
  const [itemKeys, setItemKeys] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [adminViewStudent, setAdminViewStudent] = useState<StudentInfo | null>(null);
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>("전체");
  const [pendingEdits, setPendingEdits] = useState<Record<string, number | string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [studentNameInput, setStudentNameInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isNoticeExpanded, setIsNoticeExpanded] = useState(false);
  const [canExpandNotice, setCanExpandNotice] = useState(false);
  const [isEditingNotice, setIsEditingNotice] = useState(false);
  const [editNoticeText, setEditNoticeText] = useState("");
  const [isUpdatingNotice, setIsUpdatingNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      else setIsRefreshing(true);
      setError(null);

      // Fetch Info Sheet
      const infoUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("정보")}&t=${Date.now()}`;
      const infoRes = await fetch(infoUrl);
      const infoCsv = await infoRes.text();
      
      const infoData = Papa.parse<string[]>(infoCsv, { header: false }).data;
      const headerRow = infoData[0] || [];
      const trimmedHeaderRow = headerRow.map(h => (h || "").toString().trim());
      
      // Find column indices
      const nameIdx = trimmedHeaderRow.indexOf("이름");
      const schoolIdx = trimmedHeaderRow.indexOf("학교");
      const gradeIdx = trimmedHeaderRow.indexOf("학년");
      const dateIdx = trimmedHeaderRow.findIndex(col => col.startsWith("날짜("));
      const reportIdx = trimmedHeaderRow.indexOf("숙제 리포트 url");
      const pwIdx = trimmedHeaderRow.indexOf("비밀번호");
      const masterPwIdx = trimmedHeaderRow.indexOf("마스터 비밀번호");
      const classIdx = trimmedHeaderRow.indexOf("소속");
      const timetableIdx = trimmedHeaderRow.indexOf("시간표");
      const noticeIdx = trimmedHeaderRow.indexOf("공지사항");
      const noticeHiddenIdx = trimmedHeaderRow.indexOf("공지잠금");

      let examName = "시험";
      if (dateIdx !== -1) {
        const match = trimmedHeaderRow[dateIdx].match(/\((.*)\)/);
        if (match) examName = match[1];
      }

      // Skip header row
      const parsedStudents: StudentInfo[] = infoData.slice(1)
        .filter(row => row[nameIdx !== -1 ? nameIdx : 0]) // Filter empty rows
        .map(row => ({
          name: (row[nameIdx !== -1 ? nameIdx : 0] || "").toString().trim(),
          school: row[schoolIdx !== -1 ? schoolIdx : 1],
          grade: row[gradeIdx !== -1 ? gradeIdx : 2],
          midtermDate: row[dateIdx !== -1 ? dateIdx : 3],
          reportUrl: row[reportIdx !== -1 ? reportIdx : 4],
          password: (row[pwIdx !== -1 ? pwIdx : 5] || "").toString().trim(),
          masterPassword: (masterPwIdx !== -1 ? (row[masterPwIdx] || "") : "").toString().trim(),
          examName: examName,
          classGroup: classIdx !== -1 ? (row[classIdx] || "").toString().trim() : "",
          timetable: timetableIdx !== -1 ? (row[timetableIdx] || "").toString().trim() : "",
          notice: noticeIdx !== -1 ? (row[noticeIdx] || "").toString().trim() : "",
          noticeHidden: noticeHiddenIdx !== -1 ? (row[noticeHiddenIdx] || "").toString().trim().toLowerCase() === "true" : false
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ko"));
      setStudents(parsedStudents);

      // Fetch Progress Sheet
      const progressUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("진행률")}&t=${Date.now()}`;
      const progressRes = await fetch(progressUrl);
      const progressCsv = await progressRes.text();
      
      const progressData = Papa.parse<string[]>(progressCsv, { header: false }).data;
      const progressHeader = progressData[0] || [];
      
      // Robust column mapping
      const trimmedHeader = progressHeader.map(h => (h || "").toString().trim());
      const nameColIdx = trimmedHeader.findIndex(h => h === "이름");
      const unitColIdx = trimmedHeader.findIndex(h => h === "단원");
      
      if (nameColIdx === -1 || unitColIdx === -1) {
        setError("진행률 시트에서 '이름' 또는 '단원' 컬럼을 찾을 수 없습니다.");
        return;
      }

      const items: { label: string; key: string; colIdx: number }[] = [];
      trimmedHeader.forEach((label, i) => {
        if (i !== nameColIdx && i !== unitColIdx && label !== "") {
          items.push({
            label: label,
            key: `item${i}`,
            colIdx: i
          });
        }
      });
      
      setItemLabels(items.map(it => it.label));
      setItemKeys(items.map(it => it.key));

      // Skip header row
      const parsedProgress: ProgressData[] = progressData.slice(1)
        .filter(row => (row[nameColIdx] || "").toString().trim() !== "")
        .map((row) => {
          const data: ProgressData = {
            name: row[nameColIdx].toString().trim(),
            unit: row[unitColIdx].toString().trim(),
          };
          
          items.forEach((item) => {
            const cellValue = row[item.colIdx];
            const rawVal = (cellValue === undefined || cellValue === null) ? "" : cellValue.toString().trim();
            const cleanVal = rawVal.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
            
            if (cleanVal === "") {
              // Strictly empty cell -> Scheduled (예정)
              data[item.key] = 0;
            } else {
              // Try numeric parsing (handle percentages)
              const numericPart = cleanVal.replace(/%/g, "").trim();
              
              // If it's a valid number
              if (numericPart !== "" && !isNaN(Number(numericPart)) && !/^[-‐‑‒–—―−]$/.test(cleanVal)) {
                data[item.key] = Number(numericPart);
              } else {
                // Any text, dash, or non-numeric value -> Not Applicable (-)
                data[item.key] = "해당없음";
              }
            }
          });
          return data;
        });
      setAllProgress(parsedProgress);

      // Update selected student if already logged in to sync with latest data
      if (selectedStudent) {
        const updated = parsedStudents.find(s => s.name === selectedStudent.name);
        if (updated) {
          setSelectedStudent(updated);
          // If admin, also update the viewed student if it exists
          if (updated.name === "관리자" && adminViewStudent) {
            const updatedAdminView = parsedStudents.find(s => s.name === adminViewStudent.name);
            if (updatedAdminView) setAdminViewStudent(updatedAdminView);
          }
        }
      }
    } catch (err) {
      setError("데이터를 불러오는 중 오류가 발생했습니다. 시트 설정을 확인해주세요.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  const handleLogin = () => {
    const trimmedInputName = studentNameInput.trim();
    const student = students.find(s => s.name === trimmedInputName);
    
    if (!student) {
      setLoginError(true);
      return;
    }
    
    const inputPw = String(password).trim();
    const studentPw = String(student.password || "").trim();
    const masterPw = String(student.masterPassword || "").trim();

    const isStudentPwMatch = studentPw !== "" && inputPw === studentPw;
    const isMasterPwMatch = masterPw !== "" && inputPw === masterPw;

    if (isStudentPwMatch || isMasterPwMatch) {
      setSelectedStudent(student);
      setIsAuthenticated(true);
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    setSelectedStudent(null);
    setAdminViewStudent(null);
    setStudentNameInput("");
    setPendingEdits({});
  };

  const handleEditChange = (unitName: string, itemKey: string, value: string) => {
    let finalValue: number | string = value;
    if (value !== "해당없음") {
      finalValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    }
    const editKey = `${adminViewStudent?.name}|${unitName}|${itemKey}`;
    setPendingEdits(prev => ({
      ...prev,
      [editKey]: finalValue
    }));
  };

  const handleSaveEdits = async () => {
    if (Object.keys(pendingEdits).length === 0) return;
    
    setIsSaving(true);
    try {
      const updates = Object.entries(pendingEdits).map(([key, value]) => {
        const [studentName, unitName, itemKey] = key.split("|");
        
        const keyIndex = itemKeys.indexOf(itemKey);
        const actualLabel = itemLabels[keyIndex]; 

        return { 
          studentName: studentName.trim(), 
          unitName: unitName.trim(), 
          itemKey: actualLabel.trim(),
          value: String(value) 
        };
      });

      const response = await fetch(GAS_WEBAPP_URL, {
        method: 'POST',
        body: JSON.stringify({ updates }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      
      const result = await response.json();
      
      if (result.status === "ok") {
        setToast({ message: "저장이 완료되었습니다.", type: "success" });
        setPendingEdits({});
        await new Promise(resolve => setTimeout(resolve, 1000));
        await fetchData(); 
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setToast({ message: "저장 실패: " + (err instanceof Error ? err.message : String(err)), type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const isAdmin = selectedStudent?.name === "관리자";
  const currentViewStudent = isAdmin ? adminViewStudent : selectedStudent;

  const handleUpdateNotice = async (newNotice: string) => {
    if (!adminViewStudent) return;
    setIsUpdatingNotice(true);
    try {
      const response = await fetch(GAS_WEBAPP_URL, {
        method: 'POST',
        body: JSON.stringify({
          updates: [{
            studentName: adminViewStudent.name,
            type: 'notice',
            value: newNotice
          }]
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === "ok") {
        setToast({ message: "공지사항이 수정되었습니다.", type: "success" });
        setIsEditingNotice(false);
        await fetchData();
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setToast({ message: "수정 실패: " + (err instanceof Error ? err.message : String(err)), type: "error" });
    } finally {
      setIsUpdatingNotice(false);
    }
  };

  const handleToggleNoticeLock = async () => {
    if (!adminViewStudent) return;
    const newHiddenState = !adminViewStudent.noticeHidden;
    setIsUpdatingNotice(true);
    try {
      const response = await fetch(GAS_WEBAPP_URL, {
        method: 'POST',
        body: JSON.stringify({
          updates: [{
            studentName: adminViewStudent.name,
            type: 'noticeHidden',
            value: String(newHiddenState)
          }]
        }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await response.json();
      if (result.status === "ok") {
        setToast({ message: newHiddenState ? "공지사항이 잠겼습니다." : "공지사항 잠금이 해제되었습니다.", type: "success" });
        await fetchData();
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      setToast({ message: "잠금 설정 실패: " + (err instanceof Error ? err.message : String(err)), type: "error" });
    } finally {
      setIsUpdatingNotice(false);
    }
  };


  const classGroups = useMemo(() => {
    const groups = new Set<string>();
    students.forEach(s => {
      if (s.name !== "관리자" && s.classGroup) {
        groups.add(s.classGroup);
      }
    });
    return ["전체", ...Array.from(groups).sort()];
  }, [students]);

  // Filter progress for the authenticated student (or selected student for admin)
  const studentProgress = useMemo(() => {
    if (!currentViewStudent) return [];
    return allProgress.filter(p => p.name === currentViewStudent.name);
  }, [allProgress, currentViewStudent]);

  // Identify keys that are NOT "해당없음" for at least one unit for THIS student
  // If all units for the selected student are "해당없음" (-), the entire column/item is excluded.
  const validItemKeys = useMemo(() => {
    if (studentProgress.length === 0) return [];
    return itemKeys.filter(key => {
      return studentProgress.some(p => p[key] !== "해당없음");
    });
  }, [studentProgress, itemKeys]);

  // Chart A: Unit-wise average
  const unitChartData = useMemo(() => {
    return studentProgress.map(p => {
      const values = validItemKeys
        .map(key => p[key])
        .filter((val): val is number => typeof val === "number");
      
      const completedItems = validItemKeys
        .filter(key => {
          const val = p[key];
          return typeof val === "number" && val >= 100;
        })
        .map(key => {
          const labelIndex = itemKeys.indexOf(key);
          return itemLabels[labelIndex];
        });

      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return {
        unit: p.unit,
        average: Math.round(avg),
        completedList: completedItems.length > 0 ? completedItems.join(", ") : "없음"
      };
    });
  }, [studentProgress, validItemKeys, itemKeys, itemLabels]);

  // Chart B: Item-wise average across all units
  const itemChartData = useMemo(() => {
    if (studentProgress.length === 0) return [];
    
    return validItemKeys.map((key) => {
      const labelIndex = itemKeys.indexOf(key);
      const values = studentProgress
        .map(p => p[key])
        .filter((val): val is number => typeof val === "number");
      
      const completedUnits = studentProgress
        .filter(p => {
          const val = p[key];
          return typeof val === "number" && val >= 100;
        })
        .map(p => p.unit.length > 4 ? p.unit.substring(0, 4) : p.unit);

      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return {
        item: itemLabels[labelIndex],
        average: Math.round(avg),
        completedList: completedUnits.length > 0 ? completedUnits.join(", ") : "없음"
      };
    });
  }, [studentProgress, validItemKeys, itemKeys, itemLabels]);

  // Calculate Total Progress
  const totalProgress = useMemo(() => {
    if (studentProgress.length === 0) return 0;
    const allValues = studentProgress.flatMap(p => 
      validItemKeys.map(key => p[key]).filter((val): val is number => typeof val === "number")
    );
    if (allValues.length === 0) return 0;
    return Math.round(allValues.reduce((a, b) => a + b, 0) / allValues.length);
  }, [studentProgress, validItemKeys]);

  // Calculate D-Day
  const dDay = useMemo(() => {
    if (!currentViewStudent?.midtermDate) return null;
    const target = new Date(currentViewStudent.midtermDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = target.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  }, [currentViewStudent]);

  const formattedExamInfo = useMemo(() => {
    if (!currentViewStudent?.midtermDate) return "지필평가 D-Day";
    try {
      const date = new Date(currentViewStudent.midtermDate);
      if (isNaN(date.getTime())) return "지필평가 D-Day";
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const timetable = currentViewStudent.timetable || "";
      return `${month}월 ${day}일 ${timetable}`.trim().replace(/\s+/g, ' ');
    } catch (e) {
      return "지필평가 D-Day";
    }
  }, [currentViewStudent]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">데이터를 불러오고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">오류 발생</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <LoginView 
            studentNameInput={studentNameInput}
            setStudentNameInput={setStudentNameInput}
            password={password}
            setPassword={setPassword}
            loginError={loginError}
            handleLogin={handleLogin}
          />
        ) : (
          <div className="pt-[48px] md:pt-0">
            {/* Mobile Fixed Top Bar - Only for Authenticated Users */}
            <div className="fixed top-0 left-0 w-full h-[48px] bg-white/70 backdrop-blur-md z-[100] flex items-center justify-center md:hidden">
              <span className="text-[17px] font-semibold text-slate-900 font-paperlogy tracking-tight">리드인독서논술국어학원</span>
            </div>

            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-6xl mx-auto p-4 md:p-8"
            >
            <DashboardHeader 
              isAdmin={isAdmin}
              currentViewStudent={currentViewStudent}
              adminViewStudent={adminViewStudent}
              setAdminViewStudent={setAdminViewStudent}
              students={students}
              classGroups={classGroups}
              selectedClassGroup={selectedClassGroup}
              setSelectedClassGroup={setSelectedClassGroup}
              isRefreshing={isRefreshing}
              fetchData={fetchData}
              handleLogout={handleLogout}
            />

            <div className="mt-4 mb-8">
              <NoticeBanner 
                isAdmin={isAdmin}
                adminViewStudent={adminViewStudent}
                currentViewStudent={currentViewStudent}
                isNoticeExpanded={isNoticeExpanded}
                setIsNoticeExpanded={setIsNoticeExpanded}
                canExpandNotice={canExpandNotice}
                setCanExpandNotice={setCanExpandNotice}
                isEditingNotice={isEditingNotice}
                setIsEditingNotice={setIsEditingNotice}
                editNoticeText={editNoticeText}
                setEditNoticeText={setEditNoticeText}
                isUpdatingNotice={isUpdatingNotice}
                handleUpdateNotice={handleUpdateNotice}
                handleToggleNoticeLock={handleToggleNoticeLock}
              />
            </div>

            <div className="space-y-8">
              {currentViewStudent ? (
                <>
                  <StatsCards 
                    currentViewStudent={currentViewStudent}
                    formattedExamInfo={formattedExamInfo}
                    dDay={dDay}
                    totalProgress={totalProgress}
                  />

                  <ProgressCharts 
                    isAdmin={isAdmin}
                    currentViewStudent={currentViewStudent}
                    loading={loading}
                    unitChartData={unitChartData}
                    itemChartData={itemChartData}
                  />

                  <ProgressTable 
                    isAdmin={isAdmin}
                    adminViewStudent={adminViewStudent}
                    studentProgress={studentProgress}
                    validItemKeys={validItemKeys}
                    itemKeys={itemKeys}
                    itemLabels={itemLabels}
                    pendingEdits={pendingEdits}
                    setPendingEdits={setPendingEdits}
                    isSaving={isSaving}
                    handleSaveEdits={handleSaveEdits}
                    handleEditChange={handleEditChange}
                  />
                </>
              ) : (
                <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-100 text-center">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <User className="w-10 h-10 text-blue-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">학생을 선택해 주세요</h2>
                  <p className="text-slate-500">상단 드롭다운 메뉴에서 학습 현황을 확인할 학생을 선택해 주세요.</p>
                </div>
              )}
            </div>

            <footer className="flex flex-col md:flex-row justify-between items-center gap-2 text-slate-400 text-xs py-8 px-4 font-suit">
              <span className="order-2 md:order-1 font-suit">&copy; 2026 리드인독서논술국어학원. All rights reserved.</span>
              <span className="order-1 md:order-2 font-suit">{APP_VERSION}</span>
            </footer>

            <Toast toast={toast} />
          </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
