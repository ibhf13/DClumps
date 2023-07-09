interface Report {
  report_version: string;
  report_timestamp: string;
  target_language: string;
  report_summary: ReportSummary;
  project_info: ProjectInfo;
  detector: Detector;
  data_clumps: { [key: string]: DataClump };
}

interface ReportSummary {
  amount_data_clumps: number;
}

interface ProjectInfo {
  project_name: string;
  project_version: string;
  project_commit: string;
  additional: { [key: string]: any };
}

interface Detector {
  name: string;
  version: string;
  options: Options;
}

interface Options {
  sharedFieldParametersMinimum: number;
  sharedFieldParametersCheckIfAreSubtypes: boolean;
  subclassInheritsAllMembersFromSuperclass: boolean;
  sharedMethodParametersMinimum: number;
  sharedMethodParametersHierarchyConsidered: boolean;
  analyseMethodsWithUnknownHierarchy: boolean;
}

interface DataClump {
  type: string;
  key: string;
  from_file_path: string;
  from_class_or_interface_name: string;
  from_class_or_interface_key: string;
  from_method_name: string;
  from_method_key: string;
  to_file_path: string;
  to_class_or_interface_name: string;
  to_class_or_interface_key: string;
  to_method_name: string;
  to_method_key: string;
  data_clump_type: string;
  data_clump_data: { [key: string]: DataClumpData };
}

interface DataClumpData {
  key: string;
  name: string;
  type: string;
  modifiers: any[];
  to_variable: ToVariable;
  position: Position;
}

interface ToVariable {
  key: string;
  name: string;
  type: string;
  modifiers: any[];
  position: Position;
}

interface Position {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}
