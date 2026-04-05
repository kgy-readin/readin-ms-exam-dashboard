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
}

export interface ProgressData {
  name: string;
  unit: string;
  [key: string]: string | number;
}
