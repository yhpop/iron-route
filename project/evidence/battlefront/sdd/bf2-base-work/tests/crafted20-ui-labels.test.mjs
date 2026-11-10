import test from 'node:test';
import assert from 'node:assert/strict';
import {getCraftedMission,listCraftedMissions} from '../src/content/crafted20/index.js';
import {createGame} from '../src/campaign-simulation.js';
import {createUI} from '../src/campaign-ui.js';
import {makeDOM} from './input-dom.mjs';

// Presentation-state fixtures only: no claim of input-driven objective completion.
test('authored recovery mission names clearing, meeting, and delivery destinations in briefing and active HUD',t=>{
 const spec=getCraftedMission('crafted20-003'),dom=makeDOM(),ui=createUI({...dom,missions:listCraftedMissions(),campaign:{id:'crafted20-v1',title:'手工战役'}});
 t.after(()=>ui.dispose());const state=createGame(spec),progress={unlockedIds:[spec.id],bestResults:{},selectedMissionId:spec.id};
 ui.render(state,spec,progress);
 const labels=['清除弯道火力点','驶入西侧会合区，留出车道','护送补给车到东侧货场'];
 assert.deepEqual(dom.mount.querySelectorAll('.campaign-brief-objective').map(node=>node.textContent),labels);
 for(let index=0;index<spec.objectives.length;index++){
  const objectiveStates=Object.fromEntries(spec.objectives.map((goal,position)=>[goal.id,{status:position<index?'complete':position===index?'active':'locked'}]));
  ui.render({...state,phase:'playing',objectiveStates},spec,progress);
  assert.equal(dom.mount.querySelector('.campaign-objective').textContent,`${index}/3 · ${labels[index]}`);
 }
});
