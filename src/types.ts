export interface StudentInfo {
  name: string;
  school: string;
  grade: string;
  midtermDate: string;
  reportUrl: string;
  password?: string;
  masterPassword?: string;
  examName?: string;
  classGroup?: string;
  timetable?: string;
  notice?: string;
  noticeHidden?: boolean;
  publicId?: string;
  adminId?: string;
}

export interface ProgressData {
  name: string;
  unit: string;
  [key: string]: string | number;
}
