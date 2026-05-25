// import { Card } from './ui/card';
// import { Switch } from './ui/switch';
// import { Slider } from './ui/slider';
// import { Badge } from './ui/badge';
// import type { Device } from '../App';

// interface DeviceCardProps {
//   device: Device;
//   onToggle: (id: string) => void;
//   onValueChange: (id: string, value: number) => void;
// }

// export function DeviceCard({ device, onToggle, onValueChange }: DeviceCardProps) {
//   const Icon = device.icon;
//   const hasValue = device.type === 'light' || device.type === 'thermostat' || device.type === 'fan';
  
//   const getValueLabel = () => {
//     if (device.type === 'thermostat') return `${device.value}°F`;
//     if (device.type === 'light') return `${device.value}%`;
//     if (device.type === 'fan') return `${device.value}%`;
//     return '';
//   };

//   const getStatusColor = () => {
//     if (device.status === 'offline') return 'bg-slate-500';
//     return device.isOn ? 'bg-green-500' : 'bg-slate-300';
//   };

//   return (
//     <Card className={`p-6 transition-all hover:shadow-lg ${device.status === 'offline' ? 'opacity-60' : ''}`}>
//       <div className="flex flex-col gap-4">
//         {/* Header */}
//         <div className="flex items-start justify-between">
//           <div className="flex items-center gap-3">
//             <div className={`p-3 rounded-lg ${device.isOn && device.status === 'online' ? 'bg-blue-100' : 'bg-slate-100'}`}>
//               <Icon className={`w-6 h-6 ${device.isOn && device.status === 'online' ? 'text-blue-600' : 'text-slate-400'}`} />
//             </div>
//             <div>
//               <h3 className="text-slate-900">{device.name}</h3>
//               <Badge variant={device.status === 'online' ? 'default' : 'secondary'} className="mt-1">
//                 {device.status}
//               </Badge>
//             </div>
//           </div>
          
//           <div className="relative">
//             <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
//           </div>
//         </div>

//         {/* Controls */}
//         <div className="flex flex-col gap-3 pt-2 border-t border-slate-100">
//           <div className="flex items-center justify-between">
//             <span className="text-slate-600">Power</span>
//             <Switch
//               checked={device.isOn}
//               onCheckedChange={() => onToggle(device.id)}
//               disabled={device.status === 'offline'}
//             />
//           </div>

//           {hasValue && device.isOn && device.status === 'online' && (
//             <div className="flex flex-col gap-2">
//               <div className="flex items-center justify-between">
//                 <span className="text-slate-600">
//                   {device.type === 'thermostat' ? 'Temperature' : device.type === 'fan' ? 'Speed' : 'Brightness'}
//                 </span>
//                 <span className="text-slate-900">{getValueLabel()}</span>
//               </div>
//               <Slider
//                 value={[device.value || 0]}
//                 onValueChange={(values) => onValueChange(device.id, values[0])}
//                 min={device.type === 'thermostat' ? 60 : 0}
//                 max={device.type === 'thermostat' ? 85 : 100}
//                 step={1}
//                 className="w-full"
//               />
//             </div>
//           )}
//         </div>
//       </div>
//     </Card>
//   );
// }
