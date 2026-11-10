// QA-only driver action plans. These issue controls, never mutate simulation state.
const d=(x,z,options={})=>['drive',x,z,options],s=id=>['shoot',id],w=(...ids)=>['wait',ids];
const recovery={
 'crafted20-003':[d(-18,-6),s('bend-gun'),d(-18,18,{reverse:true,pace:false}),d(-18,0),d(0,0),d(0,-25),d(14,-30),d(22,-33),w('recovery-truck')],
 'crafted20-008':[d(-10,28),d(-10,-2),s('west-berth-gun'),d(-10,22),d(10,22),d(10,-2),s('east-berth-gun'),d(10,22),d(-18,22),d(-18,-20),d(-12,-34),d(-12,-40),w('west-berth-truck'),d(-20,-40,{pace:false}),d(-20,22,{pace:false}),d(18,22),d(18,-20),d(12,-34),d(12,-40),w('east-berth-truck')],
 'crafted20-012':[d(-18,-18),d(0,-18),s('spur-gun'),d(10,-18),d(10,-24),d(13,-24),d(0,-24,{reverse:true,pace:false}),d(-24,-24,{pace:false}),d(-24,30),d(-24,37),w('spur-truck')],
 'crafted20-014':[d(-8,29),s('wall-south-gun'),d(-17,21),d(-17,-27),s('wall-north-gun'),d(-15,-35),d(-15,-41),w('wall-truck')],
 'crafted20-020':[d(-23,0),s('final-west-armor'),d(-23,25),d(25,25),d(25,4),s('final-east-armor'),d(25,25),d(-22,25),d(-22,0),d(-22,-15),d(0,-15),d(0,-36),d(18,-36),d(25,-36),w('last-supply-truck')],
};
const alternative={
 'crafted20-001':[d(-28,18),d(-28,-20),d(-6,-20),s('corner-gun'),d(16,-20),d(16,-28)],
 'crafted20-002':[d(9,12),d(5,-7),s('armored-yard-gun'),d(5,-33),d(0,-33)],
 'crafted20-003':[d(-18,0),d(-4,0),s('bend-gun'),d(-18,0),d(-26,10),d(-26,0),d(-18,0),d(0,0),d(0,-25),d(14,-30),d(22,-33),w('recovery-truck')],
 'crafted20-004':[d(22,20),d(22,2),s('crossing-gun'),d(22,3),d(-18,3),d(-18,-27),d(0,-32)],
 'crafted20-005':[d(16,29),d(16,4),s('triangle-east'),d(16,14),d(-15,14),d(-15,6),s('triangle-west'),d(-15,-28),d(0,-32)],
 'crafted20-006':[d(26,28),d(26,-28),s('quay-armor'),d(18,-33)],
 'crafted20-007':[d(9,18),s('optional-repair-fence'),d(9,-8),d(-8,-8),d(-8,-16),s('service-gun'),d(-8,-31),d(24,-30)],
 'crafted20-008':[d(10,26),s('east-berth-gun'),d(-10,26),s('west-berth-gun'),d(-4,20),d(0,-3),w('west-berth-truck'),d(0,20),d(4,20),d(0,-3),w('east-berth-truck')],
 'crafted20-009':[d(-27,28),d(-27,-8),d(-18,-8),s('north-facing-pump-gun'),d(-18,0),d(-5,0),d(-5,-14),d(27,-14),d(27,-25)],
 'crafted20-010':[d(-23,-8),d(-23,-16),d(-9,-16),s('basin-north-gun'),d(24,-17),d(24,-9)],
 'crafted20-011':[d(23,21),d(23,1),s('diagonal-rail-gun'),d(23,-35),d(5,-35)],
 'crafted20-012':[d(16,29),d(16,10),s('spur-gun'),d(16,-18),d(24,-24),d(24,-12),d(-18,-12),d(-18,30),d(-18,37),w('spur-truck')],
 'crafted20-013':[d(-14,30),d(-14,-22),s('north-cross-armor'),d(-14,12),d(24,12),s('east-cross-armor'),d(14,12),d(14,-35),d(0,-35)],
 'crafted20-014':[d(-8,29),s('wall-south-gun'),d(29,29),d(29,-28),d(20,-28),s('wall-north-gun'),d(29,-28),d(29,29),d(-17,29),d(-17,21),d(-17,-27),d(-15,-35),d(-15,-41),w('wall-truck')],
 'crafted20-015':[d(-18,0),s('west-service-fence'),d(0,0),s('workshop-armor'),d(0,-7),d(18,-7),d(29,-7),d(29,-29),d(23,-29)],
 'crafted20-016':[d(-21,29),d(-21,-17),d(-14,-17),d(-21,-17),d(-21,29),d(-36,29),d(-36,-34),d(26,-34),d(26,-25),s('embankment-gun'),d(26,5),d(27,30)],
 'crafted20-017':[d(0,30),d(14,30),d(14,5),s('east-bank-gun'),d(14,-32),d(-14,-32),s('west-bank-gun'),d(-14,-34),w('west-bank-truck','east-bank-truck')],
 'crafted20-018':[d(21,29),d(21,-13),s('command-north-armor'),d(21,29),d(-20,29),d(-20,9),s('command-west-armor'),d(-20,-30),d(-2,-30),d(-2,-39),d(21,-39)],
 'crafted20-019':[d(-18,17),s('return-road-gun'),d(-15,-31),d(0,-31),d(-15,-31),d(-15,29),d(-28,29)],
 'crafted20-020':[d(25,28),d(25,4),s('final-east-armor'),d(25,25),d(-23,25),d(-23,0),s('final-west-armor'),d(-30,21),d(-30,-15),d(0,-15),d(0,-36),d(18,-36),d(25,-36),w('last-supply-truck')],
};
function bayProbe(id,near){
 const pause=['idle',near?120:300];
 if(id==='crafted20-003'){const x=near?-23.5:-28.5;return[d(-18,-6),s('bend-gun'),d(x,10),pause,d(x,0),d(-18,0),d(0,0),d(0,-25),d(14,-30),d(22,-33),w('recovery-truck')];}
 if(id==='crafted20-012'){const x=near?21.5:26.5;return[d(-18,-18),d(0,-18),s('spur-gun'),d(x,-24),pause,d(x,-12),d(-18,-12),d(-18,30),d(-18,37),w('spur-truck')];}
 if(id==='crafted20-020'){const x=near?-27.5:-32.5;return[d(25,28),d(25,4),s('final-east-armor'),d(25,25),d(-23,25),d(-23,0),s('final-west-armor'),d(x,21),pause,d(x,-15),d(0,-15),d(0,-36),d(18,-36),d(25,-36),w('last-supply-truck')];}
 return null;
}
export function getActions(id,plan){return plan?.startsWith('probe-')?bayProbe(id,plan==='probe-near'):plan==='recovery'?recovery[id]:plan==='alternative'?alternative[id]:plan==='final'&&id==='crafted20-008'?[d(10,26),s('east-berth-gun'),d(-10,26),s('west-berth-gun'),d(-4,20),d(4,20),d(0,20),d(0,-3),w('west-berth-truck','east-berth-truck')]:null;}
