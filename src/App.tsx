import { useState, useEffect, useMemo } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { 
  Lock, 
  User, 
  Users,
  Calendar, 
  Link, 
  LogOut, 
  Loader2, 
  AlertCircle,
  TrendingUp,
  BookOpen,
  GraduationCap,
  CheckCircle,
  Search,
  RefreshCcw,
  Save,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import { 
  StudentInfo, 
  ProgressData
} from "./types";

const SPREADSHEET_ID = "1xIlvxq4h1riV2BucwMKjcE2wmqm64xir2r_KyFTdp94";
const APP_VERSION = "Logos 2.4.1";

export default function App() {
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [allProgress, setAllProgress] = useState<ProgressData[]>([]);
  const [itemLabels, setItemLabels] = useState<string[]>([]);
  const [itemKeys, setItemKeys] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentInfo | null>(null);
  const [adminViewStudent, setAdminViewStudent] = useState<StudentInfo | null>(null);
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>("전체");
  const [pendingEdits, setPendingEdits] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [studentNameInput, setStudentNameInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
          classGroup: classIdx !== -1 ? (row[classIdx] || "").toString().trim() : ""
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
    const numValue = Math.min(100, Math.max(0, parseInt(value) || 0));
    const editKey = `${adminViewStudent?.name}|${unitName}|${itemKey}`;
    setPendingEdits(prev => ({
      ...prev,
      [editKey]: numValue
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

      const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzLa0dc9V6ZyS9OGrVTdybUsGCDtZbEwfkpmGFLBlK79rBzNzFnuqVeBRX1A4YvNtGIyQ/exec"; 
      
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
          <motion.div 
            key="login"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen flex items-center justify-center p-4"
          >
            <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-8 h-8 text-blue-600" />
                </div>
                <h1 className="text-[24px] md:text-[24px] font-bold text-slate-900">리드인 내신 대비 대시보드</h1>
                <p className={`mt-2 ${loginError ? "text-red-500 font-semibold" : "text-slate-500"}`}>
                  {loginError ? "비밀번호가 일치하지 않습니다" : "내신 대비 학습 현황을 확인해 보세요"}
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">학생명</label>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="학생 이름을 입력해 주세요"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      value={studentNameInput}
                      onChange={(e) => setStudentNameInput(e.target.value)}
                    />
                    <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">비밀번호</label>
                  <div className="relative">
                    <input 
                      type="password"
                      placeholder="등원 번호를 입력해 주세요"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    />
                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                  </div>
                </div>

                <button 
                  onClick={handleLogin}
                  disabled={!studentNameInput || !password}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200"
                >
                  확인
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-6xl mx-auto p-4 md:p-8 space-y-8"
          >
            {/* Header */}
            <header className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-600 font-semibold">
                  <GraduationCap className="w-5 h-5" />
                  <span>
                    {isAdmin ? "리드인 내신 대비 대시보드" : `${currentViewStudent?.school} ${currentViewStudent?.grade}`}
                  </span>
                </div>
                <h1 className="text-[24px] md:text-[28px] font-bold text-slate-900">
                  {isAdmin ? "학생별 대시보드 관리" : `${currentViewStudent?.name} 학생 내신 대비`}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <select 
                        className="w-[85px] h-10 pt-[10px] pb-[10px] pl-[33px] pr-[10px] text-[13px] sm:w-[95px] sm:h-auto sm:pl-10 sm:pr-3 sm:py-3 sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none transition-all font-semibold text-slate-700"
                        onChange={(e) => {
                          setSelectedClassGroup(e.target.value);
                          // Reset student if they are not in the new class
                          if (e.target.value !== "전체" && adminViewStudent && adminViewStudent.classGroup !== e.target.value) {
                            setAdminViewStudent(null);
                          }
                        }}
                        value={selectedClassGroup}
                      >
                        {classGroups.map(group => (
                          <option key={group} value={group}>{group}</option>
                        ))}
                      </select>
                      <Users className="absolute left-3 top-[13px] sm:top-3.5 w-[15px] h-[15px] sm:w-[18px] sm:h-[18px] text-slate-400" />
                    </div>

                    <div className="relative">
                      <select 
                        className="w-[85px] h-10 pt-[10px] pb-[10px] pl-[33px] pr-[10px] text-[13px] sm:w-[95px] sm:h-auto sm:pl-10 sm:pr-3 sm:py-3 sm:text-sm bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none transition-all font-semibold text-slate-700"
                        onChange={(e) => {
                          const student = students.find(s => s.name === e.target.value);
                          setAdminViewStudent(student || null);
                        }}
                        value={adminViewStudent?.name || ""}
                      >
                        <option value="">선택</option>
                        {students
                          .filter(s => s.name !== "관리자")
                          .filter(s => selectedClassGroup === "전체" || s.classGroup === selectedClassGroup)
                          .map(s => (
                            <option key={s.name} value={s.name}>{s.name}</option>
                          ))
                        }
                      </select>
                      <User className="absolute left-3 top-[13px] sm:top-3.5 w-[15px] h-[15px] sm:w-[18px] sm:h-[18px] text-slate-400" />
                    </div>
                  </div>
                ) : (
                  currentViewStudent?.reportUrl && (
                    <a 
                      href={currentViewStudent.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all shadow-sm border border-blue-100 flex items-center justify-center gap-2"
                      title="숙제 리포트 보기"
                    >
                      <Link className="w-6 h-6" />
                      <span className="font-semibold text-sm">숙제 리포트</span>
                    </a>
                  )
                )}

                <button 
                  onClick={() => fetchData(false)}
                  disabled={isRefreshing}
                  className="w-10 h-10 pl-0 sm:w-auto sm:h-auto sm:p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-blue-50 hover:text-blue-600 transition-all flex items-center justify-center disabled:opacity-50"
                  title="새로고침"
                >
                  <RefreshCcw className={`w-[18px] h-[18px] sm:w-6 sm:h-6 ${isRefreshing ? "animate-spin" : ""}`} />
                </button>

                <button 
                  onClick={handleLogout}
                  className="w-10 h-10 sm:w-auto sm:h-auto sm:p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all flex items-center justify-center"
                  title="로그아웃"
                >
                  <LogOut className="w-[18px] h-[18px] sm:w-6 sm:h-6" />
                </button>
              </div>
            </header>

            {/* Stats & Charts Grid (Only show if a student is selected or it's a regular student) */}
            {currentViewStudent ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 1. D-Day Block */}
                  <div className="order-1">
                    <div className="bg-blue-50 p-6 rounded-3xl shadow-sm border border-blue-100 flex items-center justify-between h-[100px]">
                      <div className="flex items-center gap-4">
                        <div className="w-[46px] h-[46px] bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-blue-600 font-medium text-[15px]">지필평가 D-Day</p>
                          <h3 className="text-[21px] md:text-[23px] font-bold text-slate-900 leading-tight">{currentViewStudent?.examName || "시험"}까지</h3>
                        </div>
                      </div>
                      <div className="text-[28px] md:text-[32px] font-black text-blue-600 tracking-tighter">
                        {dDay !== null ? (dDay > 0 ? `D-${dDay}` : dDay === 0 ? "D-Day" : `D+${Math.abs(dDay)}`) : "-"}
                      </div>
                    </div>
                  </div>

              {/* 2. Total Progress Block */}
              <div className="order-2">
                <div className="bg-indigo-50 p-6 rounded-3xl shadow-sm border border-indigo-100 flex items-center justify-between h-[100px]">
                  <div className="flex items-center gap-4">
                    <div className="w-[46px] h-[46px] bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-indigo-600 font-medium text-[15px]">전체 진행률</p>
                      <h3 className="text-[21px] md:text-[23px] font-bold text-slate-900 leading-tight">학습 완성도</h3>
                    </div>
                  </div>
                  <div className="text-[28px] md:text-[32px] font-black text-indigo-600 tracking-tighter">
                    {totalProgress}%
                  </div>
                </div>
              </div>

              {/* 3. Unit-wise Chart */}
              <div className="order-3">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 h-full">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="text-[18px] font-bold text-slate-900">
                      {isAdmin && currentViewStudent && <span className="text-blue-600 mr-1">{currentViewStudent.name}</span>}
                      단원별 진행률
                    </h2>
                  </div>
                  <div className="h-[350px] w-full">
                    {!loading && unitChartData.length > 0 && (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart 
                          // @ts-ignore
                          key={`unit-chart-${unitChartData.map(d => d.unit).join(',')}`}
                          data={unitChartData} 
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="unit" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 12 }} 
                            dy={10}
                            tickFormatter={(value) => value.length > 4 ? value.substring(0, 4) : value}
                          />
                          <YAxis 
                            domain={[0, 100]} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 12 }} 
                          />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 max-w-[320px]">
                                    <p className="font-bold text-slate-900 mb-1">{data.unit}</p>
                                    <p className="text-blue-600 font-bold text-lg mb-2">진행률: {data.average}%</p>
                                    <div className="pt-2 border-t border-slate-50">
                                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">완료 항목</p>
                                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                        {data.completedList}
                                      </p>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="average" 
                            barSize={40}
                            // Use a custom shape to avoid deprecated Cell component
                            shape={(props: any) => {
                              let { x, y, width, height, average } = props;
                              const fill = average >= 80 ? '#2563eb' : average >= 50 ? '#60a5fa' : '#93c5fd';
                              
                              // Handle 0% data: ensure minimum height of 5px
                              if (height < 5) {
                                y = y - (5 - height);
                                height = 5;
                              }
                              
                              const radius = Math.min(6, height);
                              
                              // Round top corners
                              return (
                                <path 
                                  d={`M${x},${y + radius} Q${x},${y} ${x + radius},${y} L${x + width - radius},${y} Q${x + width},${y} ${x + width},${y + radius} L${x + width},${y + height} L${x},${y + height} Z`} 
                                  fill={fill} 
                                />
                              );
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>

              {/* 4. Item-wise Chart */}
              <div className="order-4">
                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 h-full">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h2 className="text-[18px] font-bold text-slate-900">
                      {isAdmin && currentViewStudent && <span className="text-indigo-600 mr-1">{currentViewStudent.name}</span>}
                      항목별 진행률
                    </h2>
                  </div>
                  <div className="h-[350px] w-full">
                    {!loading && itemChartData.length > 0 && (
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                        <BarChart 
                          // @ts-ignore
                          key={`item-chart-${itemChartData.map(d => d.item).join(',')}`}
                          data={itemChartData} 
                          layout="vertical" 
                          margin={{ top: 0, right: 20, left: -10, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis 
                            type="number" 
                            domain={[0, 100]} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748b', fontSize: 12 }} 
                          />
                          <YAxis 
                            dataKey="item" 
                            type="category" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }} 
                            width={70}
                          />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 max-w-[320px]">
                                    <p className="font-bold text-slate-900 mb-1">{data.item}</p>
                                    <p className="text-indigo-600 font-bold text-lg mb-2">진행률: {data.average}%</p>
                                    <div className="pt-2 border-t border-slate-50">
                                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">완료 단원</p>
                                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                                        {data.completedList}
                                      </p>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            dataKey="average" 
                            barSize={20}
                            // Use a custom shape to avoid deprecated Cell component
                            shape={(props: any) => {
                              let { x, y, width, height, average } = props;
                              const fill = average >= 80 ? '#4f46e5' : average >= 50 ? '#818cf8' : '#c7d2fe';
                              
                              // Handle 0% data: ensure minimum width of 5px
                              if (width < 5) {
                                width = 5;
                              }
                              
                              const radius = Math.min(6, width);
                              
                              // Round right corners
                              return (
                                <path 
                                  d={`M${x},${y} L${x + width - radius},${y} Q${x + width},${y} ${x + width},${y + radius} L${x + width},${y + height - radius} Q${x + width},${y + height} ${x + width - radius},${y + height} L${x},${y + height} Z`} 
                                  fill={fill} 
                                />
                              );
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Detail Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                    <Search className="w-5 h-5 text-slate-600" />
                  </div>
                  <h3 className="text-[18px] font-bold text-slate-900">
                    {isAdmin && currentViewStudent && <span className="text-blue-600 mr-1">{currentViewStudent.name}</span>}
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
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">단원</th>
                      {validItemKeys.map(key => {
                        const labelIndex = itemKeys.indexOf(key);
                        return (
                          <th key={key} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">
                            {itemLabels[labelIndex]}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {studentProgress.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-semibold text-slate-700 whitespace-nowrap text-[14px]">{p.unit}</td>
                        {validItemKeys.map(key => {
                          const val = p[key];
                          const editKey = `${adminViewStudent?.name}|${p.unit}|${key}`;
                          const isEdited = pendingEdits[editKey] !== undefined;
                          const displayVal = isEdited ? pendingEdits[editKey] : val;

                          if (isAdmin && adminViewStudent) {
                            return (
                              <td key={key} className="p-4 text-center">
                                <input
                                  type="number"
                                  value={displayVal === "해당없음" ? "" : displayVal}
                                  onChange={(e) => handleEditChange(p.unit, key, e.target.value)}
                                  placeholder="-"
                                  className={`w-16 px-2 py-1 text-center text-sm font-bold rounded-lg border transition-all focus:ring-2 focus:ring-indigo-200 outline-none ${
                                    isEdited 
                                      ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                                      : val === 100
                                        ? "bg-green-50 border-green-200 text-green-700"
                                        : typeof val === "number" && val > 0
                                          ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                          : "bg-slate-50 border-transparent text-slate-600 hover:border-slate-200"
                                  }`}
                                />
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
                              <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${colorClass}`}>
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
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50 z-10">항목</th>
                      {studentProgress.map((p, idx) => (
                        <th key={idx} className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap w-[76px] min-w-[76px]">
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
                          <td className="p-4 font-semibold text-slate-700 text-sm whitespace-nowrap sticky left-0 bg-white z-10 border-r border-slate-50">
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
                                  <input
                                    type="number"
                                    value={displayVal === "해당없음" ? "" : displayVal}
                                    onChange={(e) => handleEditChange(p.unit, key, e.target.value)}
                                    className={`w-12 px-1 py-1 text-center text-[10px] font-bold rounded-lg border transition-all outline-none ${
                                      isEdited 
                                        ? "bg-indigo-50 border-indigo-200 text-indigo-700" 
                                        : val === 100
                                          ? "bg-green-50 border-green-200 text-green-700"
                                          : typeof val === "number" && val > 0
                                            ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                            : "bg-slate-50 border-transparent text-slate-600"
                                    }`}
                                  />
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
                                <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold ${colorClass}`}>
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

        <footer className="flex flex-col md:flex-row justify-between items-center gap-2 text-slate-400 text-xs py-8 px-4">
          <span className="order-2 md:order-1">&copy; 2026 리드인독서논술국어학원. All rights reserved.</span>
          <span className="order-1 md:order-2">{APP_VERSION}</span>
        </footer>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: "-50%", y: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, x: "-50%", y: "-50%" }}
              className={`fixed top-1/2 left-1/2 z-50 px-8 py-4 rounded-3xl shadow-2xl flex flex-col items-center justify-center gap-4 min-w-[300px] border text-center ${
                toast.type === "success" 
                  ? "bg-white/95 backdrop-blur-sm text-emerald-600 border-emerald-100" 
                  : "bg-white/95 backdrop-blur-sm text-red-600 border-red-100"
              }`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                toast.type === "success" ? "bg-emerald-50" : "bg-red-50"
              }`}>
                {toast.type === "success" ? (
                  <CheckCircle className="w-10 h-10" />
                ) : (
                  <AlertCircle className="w-10 h-10" />
                )}
              </div>
              <span className="text-lg font-bold">{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
