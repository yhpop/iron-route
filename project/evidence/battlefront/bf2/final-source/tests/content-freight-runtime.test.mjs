import test from 'node:test';
import assert from 'node:assert/strict';
import {getMission} from '../src/content/index.js';
import {initializeEntities} from '../src/combat.js';
import {createObjectiveStates,stepTrucks,stepObjectives} from '../src/mission-runtime.js';

test('freight tutorial truck activates from the authored firing pose without a proximity deadlock',()=>{
 const mission=getMission('mission-001');
 const s={schema:1,missionId:mission.id,tick:1,elapsed:0,phase:'playing',mission,tank:{pose:{x:0,y:0,z:10,yaw:0}},tankCombat:{hp:100,maxHp:100},entities:initializeEntities(mission),objectiveStates:createObjectiveStates(mission),events:[],nextEventId:1,result:null};
 s.entities['freight-gate'].alive=false;s.entities['freight-gate'].hp=0;
 stepObjectives(s,1/60);const before=s.entities['freight-truck'].pose.z;
 stepTrucks(s,1/60,{isRouteClear:()=>true,raycast:()=>null});
 assert.ok(s.entities['freight-truck'].pose.z<before, s.entities['freight-truck'].stoppedReason);
});
