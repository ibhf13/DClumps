interface Position {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface Variable {
  key: string;
  name: string;
  type: string;
  modifiers: string[];
  position: Position;
  to_variable?: Variable;
}

interface DataClumpData {
  [key: string]: Variable;
}

interface DataClump {
  type: string;
  key: string;
  from_file_path: string;
  from_class_or_interface_name: string;
  from_class_or_interface_key: string;
  from_method_name: string | null;
  from_method_key: string | null;
  to_file_path: string;
  to_class_or_interface_name: string;
  to_class_or_interface_key: string;
  to_method_name: string | null;
  to_method_key: string | null;
  data_clump_type: string;
  data_clump_data: DataClumpData;
}

interface DataClumps {
  [key: string]: DataClump;
}

interface DetectorOptions {
  sharedFieldParametersMinimum: number;
  sharedFieldParametersCheckIfAreSubtypes: boolean;
  subclassInheritsAllMembersFromSuperclass: boolean;
  sharedMethodParametersMinimum: number;
  sharedMethodParametersHierarchyConsidered: boolean;
  analyseMethodsWithUnknownHierarchy: boolean;
}

interface Detector {
  name: string;
  version: string;
  options: DetectorOptions;
}

interface ProjectInfo {
  project_name: string;
  project_version: string;
  project_commit: string;
  additional: Record<string, unknown>;
}

interface ReportSummary {
  amount_data_clumps: number;
}

interface RootObject {
  report_version: string;
  report_timestamp: string;
  target_language: string;
  report_summary: ReportSummary;
  project_info: ProjectInfo;
  detector: Detector;
  data_clumps: DataClumps;
}
