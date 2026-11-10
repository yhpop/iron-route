// Credits remain reachable while paused/briefing; never intercept live controls.
export function updateAssetCredits(element,phase){if(!element)return;element.hidden=phase==='playing';if(element.hidden)element.open=false;}
