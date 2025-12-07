import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ 
  label, 
  checked, 
  onChange, 
  onLabel = 'ON', 
  offLabel = 'OFF',
  icon,
  disabled = false
}) => (
  <div className={`flex items-center justify-between py-3 border-b border-gray-100 last:border-0 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <div className="flex items-center gap-2">
      {icon && <span className="text-gray-500">{icon}</span>}
      <span className="text-gray-700 font-medium">{label}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold mr-2 ${checked ? 'text-green-600' : 'text-red-500'}`}>
        {checked ? onLabel : offLabel}
      </span>
      <button
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          checked ? 'bg-green-500 focus:ring-green-500' : 'bg-red-500 focus:ring-red-500'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  </div>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  suffix?: string;
}

export const Input: React.FC<InputProps> = ({ label, icon, className, suffix, ...props }) => (
  <div className={`mb-4 ${className}`}>
    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
      {icon}
      {label}
    </label>
    <div className="relative">
      <input
        {...props}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white"
      />
      {suffix && (
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 text-sm pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({ label, options, icon, className, ...props }) => (
  <div className={`mb-4 ${className}`}>
    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
      {icon}
      {label}
    </label>
    <select
      {...props}
      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white"
    >
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

export const SectionCard: React.FC<{ title: string; children: React.ReactNode; icon?: React.ReactNode }> = ({ title, children, icon }) => (
  <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden mb-6 animate-in slide-in-from-bottom-4 duration-500">
    <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center gap-3">
      {icon && <div className="p-2 bg-white rounded-full shadow-sm text-indigo-600">{icon}</div>}
      <h3 className="text-xl font-bold text-gray-800">{title}</h3>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

export const WizardNav: React.FC<{ 
  onNext?: () => void; 
  onPrev?: () => void; 
  isFirst?: boolean; 
  isLast?: boolean; 
  canGoNext?: boolean 
}> = ({ onNext, onPrev, isFirst, isLast, canGoNext = true }) => (
  <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
    <div>
      {!isFirst && (
        <button 
          onClick={onPrev}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>
      )}
    </div>
    <div>
      {onNext && (
        <button 
          onClick={onNext}
          disabled={!canGoNext}
          className={`flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg transition-all shadow-md ${!canGoNext ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700 hover:shadow-lg'}`}
        >
          {isLast ? 'Generate Report' : 'Next Step'} <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  </div>
);