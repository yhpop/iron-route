import test from 'node:test';import assert from 'node:assert/strict';
import {createObjectiveTracker} from '../src/objective-guidance.js';
import {getCraftedMission} from '../src/content/crafted20/index.js';
import {createVerticalSlice} from '../src/terrain-candidate/vertical-slice.js';
import {createGame} from '../src/campaign-simulation.js';
const fixture=(id='crafted20-005')=>{const spec=getCraftedMission(id),state=createGame(spec);state.phase='playing';return {spec,state,tracker:createObjectiveTracker()};};

test('east proximity selects the same objective identity as its point, not array-first west',()=>{
 const {spec,state,tracker}=fixture();const model=tracker.update(state,spec,{x:16,z:4});
 assert.equal(model.objective.id,'clear-triangle-east');assert.equal(model.target.id,'triangle-east');assert.equal(model.targetObjectiveId,model.objective.id);assert.equal(model.activeCount,2);assert.equal(model.freeOrder,true);
});
test('manual cycle keeps its objective across opposite-side movement without mutating simulation',()=>{
 const {spec,state,tracker}=fixture(),before=JSON.stringify(state);tracker.update(state,spec,{x:16,z:4});assert.equal(tracker.selectNext(),true);
 const m=tracker.update(state,spec,{x:16,z:-11});assert.equal(m.objective.id,'clear-triangle-west');assert.equal(m.target.id,'triangle-west');assert.equal(m.manual,true);assert.equal(JSON.stringify(state),before);
});
test('unselected completion keeps selection; selected completion releases and locked tasks never cycle',()=>{
 const {spec,state,tracker}=fixture();tracker.update(state,spec,{x:16,z:4});tracker.selectNext();tracker.update(state,spec);
 state.objectiveStates['clear-triangle-east'].status='complete';let m=tracker.update(state,spec);assert.equal(m.objective.id,'clear-triangle-west');assert.equal(m.canCycle,false);assert.equal(m.manual,true);
 state.objectiveStates['clear-triangle-west'].status='complete';state.objectiveStates['leave-triangle'].status='active';m=tracker.update(state,spec);assert.equal(m.objective.id,'leave-triangle');assert.equal(m.target.id,'triangle-exit');assert.equal(m.manual,false);
});
test('selected task with no location keeps text and drops its point instead of reusing another arrow',()=>{
 const {spec,state,tracker}=fixture();tracker.update(state,spec,{x:16,z:4});tracker.selectNext();state.entities['triangle-west'].alive=false;
 const m=tracker.update(state,spec);assert.equal(m.objective.id,'clear-triangle-west');assert.equal(m.target,null);assert.equal(m.targetObjectiveId,null);
});
test('multiple targets in one objective are not parallel tasks and remaining live targets stay navigable',()=>{
 const {spec,state,tracker}=fixture();const custom={...spec,objectives:[{id:'both',type:'disable',targetIds:['triangle-east','triangle-west'],requires:[]}]};state.objectiveStates={both:{status:'active'}};
 let m=tracker.update(state,custom,{x:16,z:4});assert.equal(m.activeCount,1);assert.equal(m.canCycle,false);assert.equal(m.target.id,'triangle-east');state.entities['triangle-east'].alive=false;m=tracker.update(state,custom);assert.equal(m.target.id,'triangle-west');
});
test('shared markers retain owning objective and mixed escort/defend goals do not promise free order',()=>{
 const {spec,state,tracker}=fixture();const custom={...spec,objectives:[{id:'a',type:'defend',targetIds:['triangle-east']},{id:'b',type:'escort',targetIds:['triangle-east']}]};state.objectiveStates={a:{status:'active'},b:{status:'active'}};
 let m=tracker.update(state,custom);assert.equal(m.objective.id,'b');assert.equal(m.targetObjectiveId,'b');assert.equal(m.freeOrder,false);tracker.selectNext();m=tracker.update(state,custom);assert.equal(m.objective.id,'a');assert.equal(m.targetObjectiveId,'a');assert.equal(m.target.type,'defend');
});
test('physical convoy choice is not a pair of selectable objectives or a menu route command',()=>{
 const {spec}=createVerticalSlice(),state=createGame(spec),tracker=createObjectiveTracker();state.phase='playing';state.objectiveStates['receive-orders'].status='complete';state.objectiveStates['escort-supply'].status='active';const before=JSON.stringify(state);
 let m=tracker.update(state,spec,{x:8,z:19});assert.equal(m.routeChoicePending,true);assert.equal(m.target.id,'choose-east');assert.equal(m.target.type,'route-choice');assert.equal(m.targetObjectiveId,null);assert.equal(m.canCycle,false);assert.equal(tracker.selectNext(),false);assert.equal(JSON.stringify(state),before);
 state.selectedConvoyChoiceId='direct';m=tracker.update(state,spec);assert.equal(m.target.id,'supply');assert.equal(m.targetObjectiveId,'escort-supply');
});
test('pause retains manual selection but blocks cycling; explicit reset handles same-id retry and mission change',()=>{
 const {spec,state,tracker}=fixture();tracker.update(state,spec,{x:16,z:4});tracker.selectNext();state.phase='paused';let m=tracker.update(state,spec,{x:16,z:4});assert.equal(m.objective.id,'clear-triangle-west');assert.equal(tracker.selectNext(),false);
 state.phase='playing';m=tracker.update(state,spec,{x:16,z:4});assert.equal(m.manual,true);tracker.reset();m=tracker.update(state,spec,{x:16,z:4});assert.equal(m.objective.id,'clear-triangle-east');assert.equal(m.manual,false);
 tracker.selectNext();const other=fixture('crafted20-013');m=tracker.update(other.state,other.spec);assert.equal(m.manual,false);assert.ok(other.spec.objectives.some(o=>o.id===m.objective.id));
});
test('all-complete state clears location and tracking with no stale selectable task',()=>{
 const {spec,state,tracker}=fixture();tracker.update(state,spec);tracker.selectNext();for(const o of Object.values(state.objectiveStates))o.status='complete';state.phase='won';const m=tracker.update(state,spec);assert.equal(m.objective,null);assert.equal(m.target,null);assert.equal(m.canCycle,false);assert.equal(m.activeCount,0);
});
