import { expect, test, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThumbnailControls } from './ThumbnailControls';
import { localApi } from './local-api';
vi.mock('./local-api',()=>({localApi:{productionThumbnails:vi.fn().mockResolvedValue({}),openProject:vi.fn().mockResolvedValue({project:{revision:7}})}}));
const saved=[{label:'A',text:'O PAI DO',mediaId:'goblin',layout:'palavra',background:'quadrinhos'},{label:'B',text:'VINGANÇA?',mediaId:'peter',layout:'palavra',border:{width:7,radius:24,colors:['#2676E8','#E63946']}}];

test('mudar a borda deB preserva a receita deA; gerarB envia somenteB',async()=>{
 const onChange=vi.fn(),onGenerated=vi.fn();render(<ThumbnailControls path="/demo" project={{type:'long'}} value={{thumbnailVariants:saved}} media={[]} onChange={onChange} onGenerated={onGenerated}/>);
 fireEvent.change(screen.getByLabelText('Versão'),{target:{value:'B'}});
 fireEvent.change(screen.getByLabelText('Espessura'),{target:{value:'9'}});
 expect(onChange.mock.calls[0][1]).toEqual([saved[0],{...saved[1],border:{...saved[1].border,width:9}}]);
 fireEvent.click(screen.getByRole('button',{name:'Gerar somente B',hidden:true}));
 await waitFor(()=>expect(onGenerated).toHaveBeenCalled());
 expect(localApi.productionThumbnails).toHaveBeenLastCalledWith({path:'/demo',variants:[saved[1]]});
});

test('aguarda gravação dos ajustes antes de permitir gerar',()=>{
 render(<ThumbnailControls path="/demo" project={{type:'long'}} value={{thumbnailVariants:saved}} media={[]} onChange={()=>{}} saving/>);
 expect(screen.getByRole('button',{name:'Gerar somente A',hidden:true})).toBeDisabled();
});
