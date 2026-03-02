# 🎬 ContentLab

**Descrição:**  
ContentLab é uma plataforma para **criação automatizada de roteiros para vídeos**, geração de títulos, prompts para thumbnails, tags e futuramente gravação e aprimoramento de áudio. O usuário pode gerenciar seus roteiros e histórico de criação de forma rápida, prática e organizada.

---

## 🔧 Tecnologias

**Frontend:**  
- [Next.js](https://nextjs.org/)  
- [Material UI](https://mui.com/)  

**Backend:**  
- [FastAPI](https://fastapi.tiangolo.com/)  
- [LangGraph](https://www.langgraph.com/) para orquestração de LLMs  
- RAG (Retrieval-Augmented Generation) para fornecer contexto aos roteiros  

**Banco de Dados:**  
- [Supabase](https://supabase.com/) (PostgreSQL) para armazenamento de dados do usuário, roteiros, histórico e configurações do canal  
- Suporte a vetores via extensão `pgvector` para armazenar embeddings de texto, permitindo buscas semânticas e RAG  

---

## 🏗 Arquitetura

- **Frontend:** Next.js + Material UI  
  - Tela de cadastro e configuração do canal do usuário  
  - Dashboard com histórico dos roteiros criados  
- **Backend:** FastAPI + LangGraph  
  - API REST organizada em camadas:
    1. **Controllers/Routes** – endpoints REST  
    2. **Services** – lógica de criação de roteiros, títulos, prompts, tags  
    3. **Repository/DB Layer** – comunicação com Supabase  
- **RAG:** Utilizado para fornecer contexto dos roteiros existentes ao LLM, usando embeddings armazenados no Supabase  

---

## ⚙️ Funcionalidades

1. Cadastro e configuração do canal do usuário  
2. Geração automática de:
   - Roteiro para vídeos longos ou curtos  
   - Título e descrição do vídeo  
   - Prompt para thumbnail  
   - Tags relevantes  
3. Dashboard com **histórico de roteiros criados**  
4. Futuramente:
   - Gravação de áudio via TTS  
   - Aprimoramento do áudio gerado  
   - Download de roteiros e áudio aprimorado  

---

## 🗄 Banco de Dados (Supabase)

- **Tabelas principais:**
  - `users` – dados do usuário  
  - `channels` – informações do canal do usuário  
  - `scripts` – roteiros gerados, títulos, prompts, tags  
  - `history` – histórico de criação de roteiros  

- **Vetores:**
  - Supabase suporta a extensão `pgvector`  
  - Permite armazenar embeddings de texto ou prompts  
  - Facilita buscas semânticas e contextualização de novos roteiros  

---

## 🚀 Próximos passos

- Implementar frontend com Next.js + Material UI  
- Criar endpoints da API REST no FastAPI  
- Integrar LangGraph para gerar roteiros e prompts  
- Implementar RAG utilizando embeddings armazenados no Supabase  
- Criar dashboard com histórico e buscas inteligentes  

---

## 📝 Observações

- O projeto foi pensado para ser escalável, permitindo a adição de funcionalidades futuras sem impactar a arquitetura existente.  
- O uso de vetores e RAG permite que o sistema lembre e melhore roteiros anteriores, tornando o processo de criação cada vez mais inteligente.
