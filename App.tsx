import React, { useState, useEffect } from 'react';
import { 
  ClipboardCopy, Cpu, Droplet, Zap, Activity, Train, Video, ShieldAlert, 
  Send, Loader2, FileText, AlertTriangle, Lightbulb, Server, UserCheck, Clock, CheckCircle
} from 'lucide-react';
import { ReportData, INITIAL_DATA, GasGeneratorInfo } from './types';
import { Toggle, Input, Select, SectionCard, WizardNav } from './components/FormComponents';
import { generateWhatsAppReport } from './services/geminiService';

const App: React.FC = () => {
  const [data, setData] = useState<ReportData>(INITIAL_DATA);
  const [generatedReport, setGeneratedReport] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showJockeyWarning, setShowJockeyWarning] = useState(false);
  const [step, setStep] = useState(1);

  const TOTAL_STEPS = 6;

  // --- Notification Logic ---
  useEffect(() => {
    // Request permission on load
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    // Check every minute if we need to send a reminder
    const intervalId = setInterval(() => {
      checkNotificationLogic();
    }, 60000); // Check every 1 minute

    return () => clearInterval(intervalId);
  }, []);

  const checkNotificationLogic = () => {
    const lastReportTimeStr = localStorage.getItem('lastReportTimestamp');
    const reminderSentFor = localStorage.getItem('reminderSentFor');

    if (!lastReportTimeStr) return;

    const lastReportTime = parseInt(lastReportTimeStr, 10);
    const now = Date.now();
    
    // Check if 2 hours have passed (2 * 60 * 60 * 1000 = 7200000 ms)
    const twoHoursMs = 7200000; 
    
    if (now - lastReportTime >= twoHoursMs) {
      // Ensure we haven't already sent a reminder for this specific report
      if (reminderSentFor === lastReportTimeStr) return;

      const date = new Date();
      const day = date.getDay(); // 0 is Sunday
      const hour = date.getHours();

      // Logic:
      // Sunday (0): Active Full Day
      // Weekdays (1-6): Active 17:00 to 06:00 (next day)
      // "17:00 to 06:00" means hour >= 17 OR hour < 6
      
      const isSunday = day === 0;
      const isWeekdayWindow = hour >= 17 || hour < 6;

      if (isSunday || isWeekdayWindow) {
        sendNotification();
        localStorage.setItem('reminderSentFor', lastReportTimeStr);
      }
    }
  };

  const sendNotification = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Safety Report Reminder", {
        body: "It has been 2 hours since your last report. Please submit the latest status.",
        icon: "https://cdn-icons-png.flaticon.com/512/10337/10337050.png" // Generic alert icon
      });
    }
  };

  // --- Handlers ---

  const updateEngine = (id: number, isUp: boolean) => {
    setData(prev => ({
      ...prev,
      engines: prev.engines.map(e => e.id === id ? { ...e, isUp } : e)
    }));
  };

  const updateGasGen = (id: number, field: keyof GasGeneratorInfo, value: any) => {
    setData(prev => ({
      ...prev,
      gasGenerators: prev.gasGenerators.map(g => g.id === id ? { ...g, [field]: value } : g)
    }));
  };

  // --- Validation Logic for Wizard ---

  const validateStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1: // Guard Info
        return !!data.guardName && !!data.patrolStartTime && !!data.patrolEndTime;
      case 2: // Engines & Pumps
        return !!data.hydrantPressure && !!data.jockeyPumpRuntime;
      case 3: // Storage & Leakage
        if (!data.tk13Level || !data.tk29Level) return false;
        
        // Validate specific leakage fields
        if (data.airLineLeak && !data.airLineLeakLocation) return false;
        if (data.hydrantLineLeak && !data.hydrantLineLeakLocation) return false;
        
        if (data.productLineLeak) {
          if (!data.leakingProduct || !data.productLineLeakLocation) return false;
        }
        
        return true;
      case 4: // Power
        if (!data.power33kvOn) {
           // If Power OFF, and Generators are supposedly running
           if (data.gasGenRunning) {
             // Check if at least one generator is used and has times
             const activeGens = data.gasGenerators.filter(g => g.used);
             if (activeGens.length === 0) return false;
             const incomplete = activeGens.some(g => !g.startTime || !g.endTime);
             if (incomplete) return false;
           }
        }
        return true;
      case 5: // Logistics
        if (data.productReceiptActive && (!data.productName || !data.productReceiptTank)) return false;
        if (data.rakePlaced) {
          if (!data.rakePlacementTime || !data.rakeUnloadingStatus) return false;
          if (data.rakeUnloadingStatus === 'Completed' && data.rakeRemoved && !data.rakeRemovalTime) return false;
        }
        return true;
      case 6: // Security
        if (!data.allCctvRunning && (!data.cctvDownCount || !data.cctvDownRemarks)) return false;
        if (!data.cbacsRunning && !data.cbacsRemarks) return false;
        if (data.watchTowerUsed && !data.watchTowerObservation) return false;
        if (data.nightVisionUsed && !data.nightVisionObservation) return false;
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    // Check flow when leaving Step 3 (Storage & Leakage)
    // We have Jockey Runtime from Step 2, and Leakage status from Step 3.
    if (step === 3) {
      const jockeyFreq = parseFloat(data.jockeyPumpRuntime);
      const isFrequent = !isNaN(jockeyFreq) && jockeyFreq < 45;
      
      // If Jockey running frequently (<45m) AND Hydrant Leak is NO
      if (isFrequent && !data.hydrantLineLeak && !data.jockeyWarningConfirmed) {
        setShowJockeyWarning(true);
        return; // Stop navigation, show modal
      }
    }

    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo(0, 0);
    }
  };

  const calculateAlerts = (): string[] => {
    const alerts: Set<string> = new Set();

    // 1. Water Tank Levels < 14m
    const tk13Val = parseFloat(data.tk13Level);
    const tk29Val = parseFloat(data.tk29Level);
    if ((!isNaN(tk13Val) && tk13Val < 14) || (!isNaN(tk29Val) && tk29Val < 14)) {
      alerts.add("*ATTENTION: Water required is less than 8280 Kl (OISD-STD-117). Maintain water levels immediately.*");
    }

    // 2. Generator Run Time > 3 Hours
    let longRunningGen = false;
    data.gasGenerators.forEach(gen => {
       if (gen.used && gen.startTime && gen.endTime) {
         const start = new Date(`1970-01-01T${gen.startTime}`);
         const end = new Date(`1970-01-01T${gen.endTime}`);
         let diffMs = end.getTime() - start.getTime();
         if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
         const hours = diffMs / (1000 * 60 * 60);
         if (hours >= 3) longRunningGen = true;
       }
    });
    if (longRunningGen && !data.power33kvOn) {
      alerts.add("*ATTENTION: Generator running > 3 hours. Changeover generator to avoid overheating.*");
    }

    // 3. Leakage Alerts
    if (data.productLineLeak) {
       alerts.add("*CRITICAL ALERT: PRODUCT LEAKAGE OBSERVED - IMMEDIATE ACTION REQUIRED.*");
    } else if (data.airLineLeak || data.hydrantLineLeak) {
       alerts.add("*Please arrest the leakage observed.*");
    }

    // 4. Jockey Pump Frequent Run (Lowest Priority)
    const jockeyFreq = parseFloat(data.jockeyPumpRuntime);
    // Add alert if confirmed by user (via modal) 
    if (!isNaN(jockeyFreq) && jockeyFreq < 45 && data.jockeyWarningConfirmed) {
       alerts.add("*ALERT: Frequent running of jockey pump water leakage to be checked.*");
    }

    // SORTING: 
    // 0. CRITICAL ALERT
    // 1. Leakage (Please arrest...)
    // 2. ATTENTION (Water, Generator)
    // 3. Jockey Pump Alert (Lowest)
    
    return Array.from(alerts).sort((a, b) => {
      const getScore = (str: string) => {
        if (str.includes("CRITICAL ALERT")) return 0;
        if (str.includes("Please arrest")) return 1;
        if (str.includes("ATTENTION")) return 2;
        if (str.includes("Frequent running of jockey pump")) return 3; // Lowest priority
        return 4;
      };
      return getScore(a) - getScore(b);
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const calculatedAlerts = calculateAlerts();
      const payload = { ...data, systemAlerts: calculatedAlerts };
      
      const report = await generateWhatsAppReport(payload);
      setGeneratedReport(report);
      setShowModal(true);
      
      localStorage.setItem('lastReportTimestamp', Date.now().toString());
      localStorage.removeItem('reminderSentFor');

    } catch (e) {
      alert("Failed to generate report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedReport);
    alert('Report copied to clipboard!');
  };

  const openWhatsApp = () => {
    const encoded = encodeURIComponent(generatedReport);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // --- Render Steps ---

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans">
      {/* Header */}
      <header className="bg-indigo-800 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-indigo-200" />
            <div>
               <h1 className="text-xl font-bold tracking-tight">Safety Report</h1>
               <p className="text-xs text-indigo-200">Step {step} of {TOTAL_STEPS}</p>
            </div>
          </div>
          <div className="flex gap-1">
             {Array.from({length: TOTAL_STEPS}).map((_, i) => (
                <div key={i} className={`h-2 w-2 rounded-full ${step > i ? 'bg-green-400' : 'bg-indigo-900'}`} />
             ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">

        {step === 1 && (
          <SectionCard title="1. Patrol Guard Detail" icon={<UserCheck className="h-5 w-5" />}>
             <div className="grid grid-cols-1 gap-4">
                <Input 
                   label="Guard Name *" 
                   placeholder="Enter name"
                   value={data.guardName}
                   onChange={e => setData({...data, guardName: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                     label="Patrolling From *" 
                     type="time"
                     value={data.patrolStartTime}
                     onChange={e => setData({...data, patrolStartTime: e.target.value})}
                     icon={<Clock className="w-4 h-4 text-gray-400" />}
                  />
                  <Input 
                     label="Patrolling To *" 
                     type="time"
                     value={data.patrolEndTime}
                     onChange={e => setData({...data, patrolEndTime: e.target.value})}
                     icon={<Clock className="w-4 h-4 text-gray-400" />}
                  />
                </div>
             </div>
             <WizardNav isFirst onNext={handleNext} canGoNext={validateStep(1)} />
          </SectionCard>
        )}
        
        {step === 2 && (
          <SectionCard title="2. Fire Engines & Pumps" icon={<Cpu className="h-5 w-5" />}>
            <label className="block text-sm font-medium text-gray-700 mb-3">Engine Status (5 Units)</label>
            <div className="flex flex-wrap gap-3 mb-6">
              {data.engines.map((engine) => (
                <div key={engine.id} className="flex-1 min-w-[120px] bg-gray-50 p-2 rounded-lg border border-gray-200 flex flex-col items-center shadow-sm">
                  <span className="text-xs font-bold text-gray-600 mb-2 uppercase">{engine.name}</span>
                  <Toggle 
                    label=""
                    checked={engine.isUp}
                    onChange={(val) => updateEngine(engine.id, val)}
                    onLabel="OK"
                    offLabel="NOT OK"
                  />
                </div>
              ))}
            </div>

            <Input 
               label="Fire Engine Remarks" 
               placeholder="Optional remarks..."
               value={data.fireEngineRemarks}
               onChange={e => setData({...data, fireEngineRemarks: e.target.value})}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <Input 
                label="Hydrant Pressure *" 
                value={data.hydrantPressure} 
                onChange={e => setData({...data, hydrantPressure: e.target.value})}
                placeholder="e.g., 7.5"
                suffix="kg/m²"
                type="number"
                step="0.1"
              />
              <Input 
                label="Jockey Pump Frequency (Mins) *" 
                value={data.jockeyPumpRuntime} 
                onChange={e => setData({...data, jockeyPumpRuntime: e.target.value})}
                placeholder="Runs every X mins"
                type="number"
                suffix="mins"
              />
            </div>
            <WizardNav onPrev={handleBack} onNext={handleNext} canGoNext={validateStep(2)} />
          </SectionCard>
        )}

        {step === 3 && (
          <SectionCard title="3. Storage & Leakages" icon={<Droplet className="h-5 w-5" />}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input 
                label="TK13 Level *" 
                type="number"
                step="0.1"
                value={data.tk13Level} 
                onChange={e => setData({...data, tk13Level: e.target.value})} 
                suffix="meters"
              />
              <Input 
                label="TK29 Level *" 
                type="number"
                step="0.1"
                value={data.tk29Level} 
                onChange={e => setData({...data, tk29Level: e.target.value})} 
                suffix="meters"
              />
            </div>
            
            <div className="border-t pt-4 mt-4 bg-orange-50 -mx-6 px-6 pb-4">
              <h4 className="text-sm font-bold text-orange-800 mb-4 flex items-center gap-2 pt-2">
                <AlertTriangle className="h-4 w-4" /> Leakage Observations
              </h4>
              
              <div className="space-y-6">
                 {/* Air Line Leak */}
                 <div className="bg-white p-3 rounded-md border border-orange-100 shadow-sm">
                   <Toggle 
                       label="Air Line Leak?" 
                       checked={data.airLineLeak} 
                       onChange={v => setData({...data, airLineLeak: v})} 
                       onLabel="YES" offLabel="NO"
                    />
                    {data.airLineLeak && (
                       <Input 
                         label="Location of Air Leak *" 
                         value={data.airLineLeakLocation} 
                         onChange={e => setData({...data, airLineLeakLocation: e.target.value})}
                         placeholder="Describe air line leak location..."
                         className="mt-3 mb-0 animate-in fade-in"
                       />
                    )}
                 </div>

                 {/* Hydrant Line Leak */}
                 <div className="bg-white p-3 rounded-md border border-orange-100 shadow-sm">
                   <Toggle 
                       label="Hydrant Line Leak?" 
                       checked={data.hydrantLineLeak} 
                       onChange={v => setData({...data, hydrantLineLeak: v})} 
                       onLabel="YES" offLabel="NO"
                    />
                    {data.hydrantLineLeak && (
                       <Input 
                         label="Location of Hydrant Leak *" 
                         value={data.hydrantLineLeakLocation} 
                         onChange={e => setData({...data, hydrantLineLeakLocation: e.target.value})}
                         placeholder="Describe hydrant line leak location..."
                         className="mt-3 mb-0 animate-in fade-in"
                       />
                    )}
                 </div>

                 {/* Product Line Leak */}
                 <div className="bg-white p-3 rounded-md border border-orange-100 shadow-sm">
                   <Toggle 
                       label="Product Line Leak?" 
                       checked={data.productLineLeak} 
                       onChange={v => setData({...data, productLineLeak: v})} 
                       onLabel="YES" offLabel="NO"
                    />
                    {data.productLineLeak && (
                      <div className="mt-3 animate-in fade-in space-y-3">
                        <Select 
                          label="Leaking Product *"
                          value={data.leakingProduct}
                          onChange={e => setData({...data, leakingProduct: e.target.value})}
                          options={[
                            { value: 'MS', label: 'MS' },
                            { value: 'HSD', label: 'HSD' },
                            { value: 'Ethanol', label: 'Ethanol' },
                            { value: 'Biodiesel', label: 'Biodiesel' },
                            { value: 'LDO', label: 'LDO' },
                            { value: 'LSHSP', label: 'LSHSP' },
                          ]}
                          className="mb-0"
                        />
                         <Input 
                           label="Location of Product Leak *" 
                           value={data.productLineLeakLocation} 
                           onChange={e => setData({...data, productLineLeakLocation: e.target.value})}
                           placeholder="Describe product leak location..."
                           className="mb-0"
                         />
                      </div>
                    )}
                 </div>
              </div>
            </div>
            <WizardNav onPrev={handleBack} onNext={handleNext} canGoNext={validateStep(3)} />
          </SectionCard>
        )}

        {step === 4 && (
          <SectionCard title="4. Power Management (33KV)" icon={<Zap className="h-5 w-5" />}>
            <Toggle 
              label="33KV Power Line Status" 
              checked={data.power33kvOn} 
              onChange={v => setData({...data, power33kvOn: v})}
              onLabel="ON"
              offLabel="OFF"
            />

            {!data.power33kvOn && (
              <div className="mt-4 p-4 bg-red-50 rounded-md border border-red-100 animate-in fade-in">
                <h4 className="text-red-800 font-semibold mb-3">Power Cut Protocol</h4>
                
                <Toggle 
                   label="Any Gas Generator Used?" 
                   checked={data.gasGenRunning} 
                   onChange={v => setData({...data, gasGenRunning: v})} 
                   onLabel="YES" offLabel="NO"
                />

                {data.gasGenRunning && (
                  <div className="mt-4 space-y-4">
                     {data.gasGenerators.map(gen => (
                       <div key={gen.id} className="bg-white p-3 rounded-md shadow-sm border border-gray-200">
                          <Toggle 
                             label={`${gen.name} Used?`}
                             checked={gen.used}
                             onChange={v => updateGasGen(gen.id, 'used', v)}
                             onLabel="YES" offLabel="NO"
                          />
                          {gen.used && (
                             <div className="grid grid-cols-2 gap-3 mt-2 animate-in fade-in">
                                <Input 
                                  type="time" 
                                  label="Start Time *" 
                                  value={gen.startTime} 
                                  onChange={e => updateGasGen(gen.id, 'startTime', e.target.value)} 
                                  className="mb-0"
                                />
                                <Input 
                                  type="time" 
                                  label="End Time *" 
                                  value={gen.endTime} 
                                  onChange={e => updateGasGen(gen.id, 'endTime', e.target.value)} 
                                  className="mb-0"
                                />
                             </div>
                          )}
                       </div>
                     ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-red-200">
                   <Toggle 
                      label="Changeover Performed?" 
                      checked={data.gasGenChangeover} 
                      onChange={v => setData({...data, gasGenChangeover: v})} 
                      onLabel="YES" offLabel="NO"
                   />
                </div>
              </div>
            )}
            <WizardNav onPrev={handleBack} onNext={handleNext} canGoNext={validateStep(4)} />
          </SectionCard>
        )}

        {step === 5 && (
          <SectionCard title="5. Logistics (Pipeline & Rake)" icon={<Train className="h-5 w-5" />}>
             <div className="mb-6">
               <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Product Receipt thru PipeLine</h4>
               <Toggle 
                  label="Receipt Status" 
                  checked={data.productReceiptActive} 
                  onChange={v => setData({...data, productReceiptActive: v})} 
                  onLabel="GOING ON" offLabel="STOPPED"
               />
               {data.productReceiptActive && (
                 <div className="grid grid-cols-2 gap-4 mt-3 animate-in fade-in">
                   <Select 
                      label="Product Name *" 
                      value={data.productName} 
                      onChange={e => setData({...data, productName: e.target.value as any})}
                      options={[{value: 'HSD', label: 'HSD'}, {value: 'MS', label: 'MS'}]}
                   />
                   <Input label="Receiving Tank No *" value={data.productReceiptTank} onChange={e => setData({...data, productReceiptTank: e.target.value})} />
                 </div>
               )}
             </div>

             <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Rake Operations</h4>
              <div className="space-y-4">
                <Toggle 
                   label="Rake Placed?" 
                   checked={data.rakePlaced} 
                   onChange={v => setData({...data, rakePlaced: v})} 
                   onLabel="YES" offLabel="NO"
                />
                
                {data.rakePlaced && (
                  <div className="animate-in fade-in space-y-4 bg-blue-50 p-4 rounded-lg">
                     <Input type="time" label="Placement Time *" value={data.rakePlacementTime} onChange={e => setData({...data, rakePlacementTime: e.target.value})} />
                     <Select 
                        label="Unloading Status *" 
                        value={data.rakeUnloadingStatus} 
                        onChange={e => setData({...data, rakeUnloadingStatus: e.target.value as any})}
                        options={[
                          {value: 'Not Started', label: 'Not Started'},
                          {value: 'Ongoing', label: 'Ongoing'},
                          {value: 'Completed', label: 'Completed'},
                        ]}
                     />
                     <div className="pt-2 border-t border-blue-100">
                        <Toggle 
                            label="Rake Removed by Railways?" 
                            checked={data.rakeRemoved} 
                            onChange={v => setData({...data, rakeRemoved: v})} 
                            disabled={data.rakeUnloadingStatus !== 'Completed'}
                            onLabel="YES" offLabel="NO"
                        />
                        {data.rakeUnloadingStatus !== 'Completed' && (
                            <p className="text-xs text-blue-600 mt-1 pl-1">* Unloading must be Completed to remove rake.</p>
                        )}
                        {data.rakeRemoved && (
                            <Input type="time" label="Removal Time *" value={data.rakeRemovalTime} onChange={e => setData({...data, rakeRemovalTime: e.target.value})} className="mt-2" />
                        )}
                     </div>
                  </div>
                )}
              </div>
             </div>
             <WizardNav onPrev={handleBack} onNext={handleNext} canGoNext={validateStep(5)} />
          </SectionCard>
        )}

        {step === 6 && (
          <SectionCard title="6. Security & Surveillance" icon={<ShieldAlert className="h-5 w-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <Toggle 
                  label="Office AC & Lighting" 
                  checked={data.officeAcLightingOn} 
                  onChange={v => setData({...data, officeAcLightingOn: v})} 
                  onLabel="ON" offLabel="OFF"
                  icon={<Lightbulb className="w-4 h-4" />}
                />
               <div>
                  <Toggle 
                    label="C BACS System" 
                    checked={data.cbacsRunning} 
                    onChange={v => setData({...data, cbacsRunning: v})} 
                    onLabel="OK" offLabel="FAULTY"
                    icon={<Server className="w-4 h-4" />}
                  />
                  {!data.cbacsRunning && (
                    <Input label="Fault Remarks *" value={data.cbacsRemarks} onChange={e => setData({...data, cbacsRemarks: e.target.value})} className="mt-2" />
                  )}
               </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
               <div className="flex items-center gap-2 mb-3">
                  <Video className="w-5 h-5 text-indigo-600" />
                  <h4 className="font-semibold text-gray-800">CCTV Status (71 Cameras)</h4>
               </div>
               <Toggle 
                 label="All 71 Cameras Running?" 
                 checked={data.allCctvRunning} 
                 onChange={v => setData({...data, allCctvRunning: v})} 
                 onLabel="YES" offLabel="NO"
               />
               {!data.allCctvRunning && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 animate-in fade-in">
                    <div className="col-span-1">
                       <Input type="number" label="Count Down *" value={data.cctvDownCount} onChange={e => setData({...data, cctvDownCount: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                       <Input label="Camera Names / Remarks *" value={data.cctvDownRemarks} onChange={e => setData({...data, cctvDownRemarks: e.target.value})} />
                    </div>
                  </div>
               )}
            </div>

            <div className="grid grid-cols-1 gap-4">
               <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                  <Toggle 
                     label="Watch Tower Used?" 
                     checked={data.watchTowerUsed} 
                     onChange={v => setData({...data, watchTowerUsed: v})} 
                     onLabel="YES" offLabel="NO"
                  />
                  <Input label="Observation *" value={data.watchTowerObservation} onChange={e => setData({...data, watchTowerObservation: e.target.value})} />
               </div>
               <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                  <Toggle 
                     label="Night Vision Binocular Used?" 
                     checked={data.nightVisionUsed} 
                     onChange={v => setData({...data, nightVisionUsed: v})} 
                     onLabel="YES" offLabel="NO"
                  />
                  <Input label="Observation *" value={data.nightVisionObservation} onChange={e => setData({...data, nightVisionObservation: e.target.value})} />
               </div>
            </div>
            <WizardNav onPrev={handleBack} onNext={handleNext} canGoNext={validateStep(6)} isLast />
          </SectionCard>
        )}

      </main>

      {/* Jockey Warning Modal */}
      {showJockeyWarning && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
             <div className="flex items-center gap-3 text-amber-600 mb-4">
                <AlertTriangle className="w-8 h-8" />
                <h3 className="text-lg font-bold">Frequent Jockey Pump Activity</h3>
             </div>
             <p className="text-gray-700 mb-6">
               Jockey pump is running frequently (every {data.jockeyPumpRuntime} mins). 
               Please confirm whether hydrant line, sprinklers, flanges of monitors, and hydrant posts have been checked by you?
             </p>
             <div className="flex flex-col gap-3">
               <button 
                 onClick={() => {
                   setData({...data, jockeyWarningConfirmed: true});
                   setShowJockeyWarning(false);
                   // Proceed to next step after confirmation
                   setStep(4);
                 }}
                 className="bg-amber-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-amber-700 transition-colors flex items-center justify-center gap-2"
               >
                 <CheckCircle className="w-5 h-5" /> Yes, I have checked
               </button>
               <button 
                 onClick={() => setShowJockeyWarning(false)}
                 className="bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
               >
                 No, let me check first
               </button>
             </div>
           </div>
         </div>
      )}

      {/* Output Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ClipboardCopy className="w-5 h-5 text-indigo-600" /> Generated Report
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
              <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-white p-4 rounded-lg border border-gray-200 shadow-sm leading-relaxed">
                {generatedReport}
              </pre>
            </div>

            <div className="p-4 border-t border-gray-100 flex gap-3 justify-end bg-white rounded-b-xl">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
              <button 
                onClick={copyToClipboard}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 font-medium hover:bg-indigo-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <ClipboardCopy className="w-4 h-4" /> Copy
              </button>
              <button 
                onClick={openWhatsApp}
                className="px-4 py-2 bg-green-600 text-white font-medium hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <Send className="w-4 h-4" /> Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;