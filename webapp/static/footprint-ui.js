/* Explicit local cleanup planning. No account login, inbox access or deletion calls. */
(function(root,factory){const planner=typeof module==='object'&&module.exports?require('./footprint-planner.js'):root.EraseFootprintPlanner;const api=factory(planner);if(typeof module==='object'&&module.exports)module.exports=api;else root.EraseFootprintUI=api;})(typeof globalThis==='object'?globalThis:this,function(planner){
  'use strict';
  const reportActions={export_completed:'I saved my export',request_prepared:'I prepared a request',request_submitted:'I submitted a request',company_confirmation:'The company told me it completed my request',search_result_removed:'I checked the search result is removed',source_removed:'I checked the source page is removed',setting_updated:'I changed the privacy setting',content_reviewed:'I reviewed selected posts and comments',recheck_reviewed:'I reviewed this item again now'};
  function create({workspace,document,onChange=()=>{},onFeedback=()=>{}}){
    let open=false,draft='',format='json',owned=false,draftProfileId=null,fileRevision=0;
    const n=(tag,text)=>{const element=document.createElement(tag);if(text)element.textContent=text;return element;};
    const button=(label,action)=>{const element=n('button',label);element.type='button';element.className='button button-secondary';element.addEventListener('click',async()=>{element.disabled=true;try{await action();}catch(error){onFeedback(error?.message||'The local cleanup plan could not be changed.');}finally{element.disabled=false;}});return element;};
    const link=(label,url)=>{const element=n('a',label);element.href=url;element.target='_blank';element.rel='noopener noreferrer';return element;};
    function render(dashboard){
      const section=n('section');section.className='footprint-panel';section.id='footprint-panel';
      const details=n('details');details.open=open;details.addEventListener('toggle',()=>{open=details.open;});
      const summary=n('summary','Plan other cleanup');details.append(summary,n('p','Import your own account list and choose what to keep, export or request removal from. This planner does not close accounts, delete posts, send requests or inspect an inbox.'));
      const profileId=dashboard.profile.id,current=()=>{if(workspace.profile().id!==profileId)throw new Error('The workspace changed. Review this cleanup list again.');};
      if(draftProfileId!==profileId){draft='';format='json';owned=false;draftProfileId=profileId;fileRevision++;}
      if(dashboard.campaign.status!=='active'){details.append(n('p','Your privacy work is paused. Resume it before editing the cleanup plan.'));section.append(details);return section;}
      const label=n('label','Account list format'),select=n('select');select.id='footprint-format';label.setAttribute('for',select.id);
      for(const value of ['json','csv']){const option=n('option',value.toUpperCase());option.value=value;select.append(option);}select.value=format;select.addEventListener('change',()=>{format=select.value;owned=false;own.checked=false;fileRevision++;});label.append(select);
      const inputLabel=n('label','Paste your own account list'),input=n('textarea');input.id='footprint-import-list';input.rows=5;input.value=draft;input.maxLength=planner.MAX_INPUT;input.autocomplete='off';input.setAttribute('autocomplete','off');inputLabel.setAttribute('for',input.id);input.addEventListener('input',()=>{draft=input.value;owned=false;own.checked=false;fileRevision++;});inputLabel.append(input);
      const example=n('p','JSON: [{"service":"Example","category":"account","url":"https://example.com/"}]. CSV headers: service,category,url. Categories: account, social, search_result, company, privacy_setting. Maximum 100 rows / 128 KiB. Public HTTPS URLs only; leave out passwords, tokens and verification links.');example.className='public-route-note';
      const fileLabel=n('label','Or choose a local CSV or JSON list'),file=n('input');file.type='file';file.accept='.csv,.json,application/json,text/csv';file.id='footprint-import-file';fileLabel.setAttribute('for',file.id);fileLabel.append(file);
      file.addEventListener('change',async()=>{const revision=++fileRevision;owned=false;own.checked=false;try{current();const chosen=file.files?.[0];if(!chosen)return;if(chosen.size>planner.MAX_INPUT)throw new Error('Choose a list smaller than 128 KiB.');const content=await chosen.text();current();if(revision!==fileRevision)return;owned=false;own.checked=false;draft=content;input.value=content;format=/\.csv$/i.test(chosen.name)?'csv':'json';select.value=format;onFeedback('The local list is ready for review. Nothing has been imported or sent.');}catch(error){if(revision!==fileRevision)return;draft='';input.value='';onFeedback(error?.message||'The account list could not be read.');}finally{file.value='';}});
      const ownLabel=n('label'),own=n('input');own.type='checkbox';own.id='footprint-own-list';own.checked=owned;ownLabel.className='checkbox-label';ownLabel.setAttribute('for',own.id);own.addEventListener('change',()=>{owned=own.checked;});ownLabel.append(own,n('span','This list concerns my own accounts and information. I reviewed it and left out credentials and private verification links.'));
      const importButton=button('Import local list',async()=>{
        if(!own.checked)throw new Error('Confirm the account list concerns your own information first.');
        current();const content=input.value,chosenFormat=select.value;fileRevision++;draft='';input.value='';owned=false;own.checked=false;
        await workspace.importFootprint(content,chosenFormat,{authorized:true,profileId});onChange();onFeedback('Cleanup items saved in this browser. No account, post or website was changed.');
      });importButton.id='footprint-import-button';details.append(label,inputLabel,fileLabel,example,ownLabel,importButton);
      const guides=n('div');guides.className='footprint-guides';guides.append(n('p','Official guidance'));
      guides.append(link(planner.GUIDES.google.label,planner.GUIDES.google.url),n('p','Removing a search result does not remove the source webpage. Eligibility and outcomes are reviewed by Google.'));
      guides.append(link(planner.GUIDES.reddit.label,planner.GUIDES.reddit.url),n('p','On Reddit, delete selected posts and comments before account closure; closing the account alone leaves that content.'));
      guides.append(link(planner.GUIDES.drop.label,planner.GUIDES.drop.url),n('p','California residents can use the free DROP system after its eligibility check. Processing is handled by the state and brokers. Erase Me starts no recurring check.'));
      details.append(guides);
      const plan=dashboard.footprint||planner.view(planner.empty());
      if(!plan.items.length)details.append(n('p','No other cleanup items yet. Imported accounts and selected pages will appear here.'));
      for(const item of plan.items){
        const article=n('article');article.className='footprint-item';article.id='footprint-item-'+item.id;const heading=n('h3',item.service);heading.id=article.id+'-heading';article.setAttribute('aria-labelledby',heading.id);article.append(heading,n('p',item.category.replace(/_/g,' ')),n('p',item.label));
        if(item.url)article.append(link('Open selected public page',item.url));
        const choiceLabel=n('label','Your decision for '+item.service),choice=n('select');choice.id=article.id+'-choice';choiceLabel.setAttribute('for',choice.id);
        const choices=[['','Choose a next step'],['keep','Keep this item'],...(item.category==='privacy_setting'?[]:[['export_first','Export before removal']]),['remove',item.category==='privacy_setting'?'Plan a privacy-setting change':'Plan a removal request']];
        for(const [value,text]of choices){const option=n('option',text);option.value=value;if(!value)option.disabled=true;choice.append(option);}choice.value=item.decision||'';choiceLabel.append(choice);article.append(choiceLabel);
        const closureLabel=n('label'),closure=n('input');closure.type='checkbox';closure.id=article.id+'-closure';closure.checked=false;closureLabel.className='checkbox-label';closureLabel.setAttribute('for',closure.id);closureLabel.append(closure,n('span','I reviewed that closing this account may remove files, purchases or access to other services. I will export anything I need first.'));
        if(item.category==='account')article.append(closureLabel);
        const save=button('Save choice for '+item.service,async()=>{current();await workspace.chooseFootprintItem(item.id,{decision:choice.value,authorized:true,closureReviewed:closure.checked,profileId});onChange();onFeedback('Your local choice was saved. No account or page was changed.');});save.id=article.id+'-save';article.append(save);
        if(['remove','export_first'].includes(item.decision)){
          const reportLabel=n('label','Report a step you performed for '+item.service),report=n('select');report.id=article.id+'-report';reportLabel.setAttribute('for',report.id);
          const events=item.decision==='export_first'&&!item.export_acknowledged?['export_completed','recheck_reviewed']:
            item.category==='privacy_setting'?['setting_updated','recheck_reviewed']:
            ['export_completed','request_prepared','request_submitted',...(['account','company','social'].includes(item.category)?['company_confirmation']:[]),...(item.category==='social'?['content_reviewed']:[]),...(item.category==='search_result'?['search_result_removed']:[]),'source_removed','recheck_reviewed'];
          for(const value of events){const option=n('option',reportActions[value]);option.value=value;report.append(option);}report.value=events[0];reportLabel.append(report);
          const record=button('Save my report for '+item.service,async()=>{current();await workspace.recordFootprintProgress(item.id,{event:report.value,authorized:true,profileId});onChange();onFeedback('Your report was saved as self-reported history. It is not independently verified deletion.');});record.id=article.id+'-record';article.append(reportLabel,record);
        }
        if(item.reports.length){const history=n('ul');for(const report of item.reports)history.append(n('li',report.label+' · '+report.at));article.append(history);}
        if(item.category==='search_result')article.append(n('p','Search-result removal and source-page removal are recorded separately. Both are user reports here.'));
        article.append(n('p','Account closure, social-content deletion, company delivery and independent verification integrations are staged. Rechecks happen only when you explicitly review and report them.'));details.append(article);
      }
      section.append(details);return section;
    }
    return Object.freeze({render});
  }
  return Object.freeze({create});
});
