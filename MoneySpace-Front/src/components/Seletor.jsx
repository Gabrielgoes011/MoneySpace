// Select simples do HeroUI para listas {id, nome}.
import { Select, ListBox } from '@heroui/react';

export default function Seletor({ rotulo, itens, valor, onChange, className = 'w-full sm:w-auto sm:min-w-48' }) {
  return (
    <Select aria-label={rotulo} selectedKey={valor} onSelectionChange={onChange} className={className}>
      <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
      <Select.Popover>
        <ListBox>
          {itens.map((i) => (
            <ListBox.Item key={i.id} id={i.id} textValue={i.nome}>{i.nome}<ListBox.ItemIndicator /></ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
