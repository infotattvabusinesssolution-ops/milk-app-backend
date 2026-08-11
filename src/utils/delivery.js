import { SystemConfig } from '../models/SystemConfig.js';

export function getDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;  
  const dLon = (lon2 - lon1) * Math.PI / 180; 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; 
}

export async function calculateDeliveryCharge(customerAddress) {
  if (!customerAddress || !customerAddress.lat || !customerAddress.lng) {
    return { charge: 0, distanceKm: 0 };
  }

  // Get settings from SystemConfig or use defaults
  let storeLocation = { lat: 26.4499, lng: 80.3319 }; // Default: Kanpur
  let deliveryChargePerKm = 10;
  let baseDeliveryFee = 20;
  
  const locationConfig = await SystemConfig.findOne({ key: 'storeLocation' });
  if (locationConfig && locationConfig.value) {
    storeLocation = locationConfig.value;
  }
  
  const perKmConfig = await SystemConfig.findOne({ key: 'deliveryChargePerKm' });
  if (perKmConfig && perKmConfig.value !== undefined) {
    deliveryChargePerKm = Number(perKmConfig.value);
  }

  const baseFeeConfig = await SystemConfig.findOne({ key: 'baseDeliveryFee' });
  if (baseFeeConfig && baseFeeConfig.value !== undefined) {
    baseDeliveryFee = Number(baseFeeConfig.value);
  }

  const distanceKm = getDistance(storeLocation.lat, storeLocation.lng, customerAddress.lat, customerAddress.lng);
  
  if (distanceKm === null) return { charge: 0, distanceKm: 0 };

  const charge = Math.round(baseDeliveryFee + (distanceKm * deliveryChargePerKm));
  return { charge, distanceKm: Number(distanceKm.toFixed(2)) };
}
