
export interface EngineStatus {
  id: number;
  name: string;
  isUp: boolean;
}

export interface GasGeneratorInfo {
  id: number;
  name: string;
  used: boolean;
  startTime: string;
  endTime: string;
}

export interface ReportData {
  // Patrol Guard
  guardName: string;
  patrolStartTime: string;
  patrolEndTime: string;

  // Engines
  engines: EngineStatus[];
  fireEngineRemarks: string;
  
  // Water Tanks
  tk13Level: string;
  tk29Level: string;
  
  // Hydrant & Pumps
  hydrantPressure: string;
  jockeyPumpRuntime: string; // Treated as numeric minutes
  jockeyWarningConfirmed: boolean;
  
  // Leakage
  airLineLeak: boolean;
  airLineLeakLocation: string; // Specific location
  
  hydrantLineLeak: boolean;
  hydrantLineLeakLocation: string; // Specific location
  
  productLineLeak: boolean;
  leakingProduct: string; // MS, HSD, Ethanol, Biodiesel, LDO, LSHSP
  productLineLeakLocation: string; // Specific location
  
  // Power
  power33kvOn: boolean;
  gasGenRunning: boolean; // General toggle for "Are we using generators?"
  gasGenChangeover: boolean;
  gasGenerators: GasGeneratorInfo[]; // 3 generators with individual times
  
  // Product Receipt
  productReceiptActive: boolean;
  productReceiptTank: string;
  productName: 'HSD' | 'MS' | '';
  
  // Rake Operations
  rakePlaced: boolean;
  rakePlacementTime: string;
  rakeUnloadingStatus: 'Not Started' | 'Ongoing' | 'Completed' | '';
  rakeRemoved: boolean;
  rakeRemovalTime: string;
  
  // Office
  officeAcLightingOn: boolean;
  
  // CCTV
  allCctvRunning: boolean;
  cctvDownCount: string;
  cctvDownRemarks: string;
  
  // Systems & Security
  cbacsRunning: boolean;
  cbacsRemarks: string;
  watchTowerUsed: boolean;
  watchTowerObservation: string;
  nightVisionUsed: boolean;
  nightVisionObservation: string;

  // Generated Alerts
  systemAlerts?: string[];
}

export const INITIAL_DATA: ReportData = {
  guardName: '',
  patrolStartTime: '',
  patrolEndTime: '',
  engines: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: `Engine ${i + 1}`, isUp: true })),
  fireEngineRemarks: '',
  tk13Level: '',
  tk29Level: '',
  hydrantPressure: '',
  jockeyPumpRuntime: '',
  jockeyWarningConfirmed: false,
  
  airLineLeak: false,
  airLineLeakLocation: '',
  
  hydrantLineLeak: false,
  hydrantLineLeakLocation: '',
  
  productLineLeak: false,
  leakingProduct: '',
  productLineLeakLocation: '',
  
  power33kvOn: true,
  gasGenRunning: false,
  gasGenChangeover: false,
  gasGenerators: [
    { id: 1, name: 'Gas Gen 1', used: false, startTime: '', endTime: '' },
    { id: 2, name: 'Gas Gen 2', used: false, startTime: '', endTime: '' },
    { id: 3, name: 'Gas Gen 3', used: false, startTime: '', endTime: '' },
  ],
  productReceiptActive: false,
  productReceiptTank: '',
  productName: '',
  rakePlaced: false,
  rakePlacementTime: '',
  rakeUnloadingStatus: '', 
  rakeRemoved: false,
  rakeRemovalTime: '',
  officeAcLightingOn: false,
  allCctvRunning: true,
  cctvDownCount: '0',
  cctvDownRemarks: '',
  cbacsRunning: true,
  cbacsRemarks: '',
  watchTowerUsed: true,
  watchTowerObservation: 'Normal',
  nightVisionUsed: true,
  nightVisionObservation: 'Nothing suspicious',
  systemAlerts: [],
};
