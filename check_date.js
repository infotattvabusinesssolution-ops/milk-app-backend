const d = new Date("Sun Aug 09 2026 14:15:50 GMT+0530");
console.log("Original:", d.toISOString());
d.setHours(0,0,0,0);
console.log("After setHours:", d.toISOString());
