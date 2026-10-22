# To-do: integrazione completa di MLA-C01 Studio

Generata da `docs/todo.json` (fonte: report sui gap di copertura, 22/10/2026).
Ogni voce di teoria è chiusa solo se compare nella teoria del capitolo (copione e slide) e in almeno 2 domande del banco. Lo stato si verifica con `tools/check_coverage.py`.

## Dati in profondità: storage, qualità, etichette e bias (`ch8-data-advanced`) — 44 voci

- [ ] **K-1.1K1** 1.1K1 Formati (Parquet, JSON, CSV, ORC, Avro, RecordIO) — Parquet, ORC, CSV, JSON spiegati (ch2); Avro e RecordIO-protobuf (formato dei built-in) mai citati
- [ ] **K-1.1K2** 1.1K2 Sorgenti core (S3, EFS, FSx for NetApp ONTAP) — S3 spiegato bene; EFS e FSx (Lustre, NetApp ONTAP) assenti da teoria e banco
- [ ] **K-1.1K4** 1.1K4 Opzioni di storage e tradeoff — Solo S3 e partizionamento; classi di storage, EBS, EFS, FSx e relativi tradeoff non trattati
- [ ] **K-1.1S1** 1.1S1 Estrazione (S3 Transfer Acceleration, EBS Provisioned IOPS, RDS, DynamoDB) — DynamoDB e RDS citati come sorgenti; S3 Transfer Acceleration solo in 3 domande; EBS Provisioned IOPS assente
- [ ] **K-1.1S5** 1.1S5 Troubleshooting capacità e scalabilità — Shard Kinesis citati; troubleshooting di throughput, throttling e modalità on-demand non spiegati
- [ ] **K-1.1S6** 1.1S6 Storage per costo, performance, struttura — Costo per formato e partizioni sì; scelta tra S3, Redshift, DynamoDB, EFS, FSx no
- [ ] **K-1.2K2** 1.2K2 Feature eng. (scaling, binning, log, splitting) — Standardizzazione e min-max sì; binning, log transform e feature splitting assenti dalla teoria
- [ ] **K-1.2K3** 1.2K3 Encoding (one-hot, binary, label, tokenizzazione) — One-hot e ordinal sì; label encoding, binary encoding e tokenizzazione non spiegati
- [ ] **K-1.2K5** 1.2K5 Trasformazione streaming (Lambda, Spark) — Trasformazione di stream con Lambda, Spark Streaming o Flink: 0 in teoria, 4 domande
- [ ] **K-1.2K6** 1.2K6 Servizi di annotazione e labeling — SageMaker Ground Truth, Mechanical Turk, A2I: 0 in teoria, 3 domande in tutto
- [ ] **K-1.2S3** 1.2S3 Ground Truth, Mechanical Turk — Ground Truth e Mechanical Turk: 2 domande, nessuna spiegazione
- [ ] **K-1.3K1** 1.3K1 Metriche bias pre-training (CI, DPL) — Clarify citato ma metriche CI e DPL mai nominate nella teoria; 3 domande
- [ ] **K-1.3K4** 1.3K4 Classificazione, anonimizzazione, masking — Anonimizzazione, masking e classificazione dei dataset non trattati; Macie in 1 domanda
- [ ] **K-1.3K5** 1.3K5 Compliance (PII, PHI, residency) — PII citata (soprattutto Guardrails); PHI, HIPAA e data residency non spiegati
- [ ] **K-1.3S1** 1.3S1 Qualità dati (DataBrew, Glue Data Quality) — Profilazione DataBrew e report di Data Wrangler sì; AWS Glue Data Quality (DQDL) solo in 2 domande
- [ ] **K-1.3S2** 1.3S2 Bias nei dati con Clarify — Clarify pre-training in una riga; selection bias e measurement bias non spiegati
- [ ] **K-1.3S3** 1.3S3 Split, shuffling, augmentation — Split train/validation/test sì; shuffling solo nel banco; augmentation appena accennata
- [ ] **K-1.3S4** 1.3S4 Caricamento dati nel training (EFS, FSx) — Solo "modalità Pipe" per XGBoost; File, FastFile, EFS e FSx for Lustre come input del training assenti
- [ ] **G-1.1.8** 1.1.8 Ingest and store diverse data types (for example, text, images, audio) for AI and ML applications.
- [ ] **G-1.2.8** 1.2.8 Mask, redact, and anonymize data.
- [ ] **G-1.3.4** 1.3.4 Optimize multimodal data distributions by applying bias metrics across numeric, text, and image assets.
- [ ] **G-1.3.7** 1.3.7 Clean data (for example, by detecting outliers, imputing missing data, deduplication).
- [ ] **G-1.1.1** 1.1.1 Extract data from data sources (for example, Amazon S3, Amazon EBS, Amazon EFS, Amazon RDS, Amazon DynamoDB, Amazon OpenSearch Service).
- [ ] **V05** Amazon EFS — mai citato
- [ ] **V06** Amazon FSx (Lustre, NetApp ONTAP) — mai citato
- [ ] **V11** Amazon Augmented AI (A2I) — mai citato
- [ ] **V16** Amazon DocumentDB — mai citato
- [ ] **V17** Amazon Neptune — mai citato
- [ ] **V25** Amazon Kinesis Video Streams — mai citato
- [ ] **V26** AWS Direct Connect — mai citato
- [ ] **V27** AWS Storage Gateway — mai citato
- [ ] **V33** Amazon EBS — solo nel banco
- [ ] **V34** Amazon ElastiCache — solo nel banco
- [ ] **V37** AWS Glue Data Quality — solo nel banco
- [ ] **V40** Amazon S3 Glacier — solo nel banco
- [ ] **V41** Amazon Managed Service for Apache Flink — solo nel banco
- [ ] **V43** Amazon Mechanical Turk — solo nel banco (MLA-C01)
- [ ] **V47** AWS DataSync — solo nel banco
- [ ] **V49** Amazon Macie — solo nel banco
- [ ] **C09** FSx for Lustre come input del training — Assente.
- [ ] **C12** Nodi EMR primary, core, task — In 2 domande.
- [ ] **C14** Lake Formation LF-Tags e permessi granulari — Assente.
- [ ] **C16** Modalità di input File, Pipe, FastFile — Solo Pipe per XGBoost.
- [ ] **C21** SageMaker Ground Truth e Ground Truth Plus — Assente dalla teoria.

## Training avanzato, algoritmi built-in e spiegabilità (`ch9-training-advanced`) — 28 voci

- [ ] **K-2.1K3** 2.1K3 Interpretabilità nella scelta — Interpretabilità solo come monitor di explainability e Model Cards, non come criterio di scelta del modello
- [ ] **K-2.1K4** 2.1K4 Algoritmi built-in — 5 built-in su circa 17 (XGBoost, Linear Learner, DeepAR, BlazingText, K-Means); RCF, k-NN, FM, IP Insights, Object2Vec, Seq2Seq, algoritmi di visione quasi assenti
- [ ] **K-2.1S1** 2.1S1 Fattibilità di una soluzione ML — Valutare la fattibilità di una soluzione ML (dati disponibili, complessità): 0 in teoria, 2 domande
- [ ] **K-2.1S4** 2.1S4 Scelta in base ai costi — Costo citato come vincolo generico, senza confronti di costo tra modelli
- [ ] **K-2.2K1** 2.2K1 Elementi del training (epoch, step, batch) — Epoch, step, batch size: 0 in teoria, presenti in alcune domande
- [ ] **K-2.2K2** 2.2K2 Ridurre tempo (early stopping, distribuito) — Early stopping sì; training distribuito (data/model parallel, librerie SageMaker) assente dalla teoria, 5 domande
- [ ] **K-2.2K3** 2.2K3 Fattori della dimensione del modello — Fattori che determinano la dimensione del modello: nessuna trattazione
- [ ] **K-2.2K4** 2.2K4 Migliorare la performance — Tuning e feature engineering sì; strategie generali di miglioramento non sistematizzate
- [ ] **K-2.2K5** 2.2K5 Regolarizzazione (dropout, weight decay, L1/L2) — "Regolarizzazione" e lambda/alpha di XGBoost; dropout, weight decay, L1/L2 assenti dalla teoria
- [ ] **K-2.2K7** 2.2K7 Iperparametri ed effetti — eta, max_depth, subsample di XGBoost; effetti di n. alberi e n. layer non generalizzati
- [ ] **K-2.2K8** 2.2K8 Modelli addestrati fuori SageMaker — BYOC via ECR sì; packaging model.tar.gz e import di modelli addestrati altrove no
- [ ] **K-2.2S2** 2.2S2 Script mode (TensorFlow, PyTorch) — Script mode con TensorFlow/PyTorch: 0 teoria, 0 domande
- [ ] **K-2.2S7** 2.2S7 Ensembling, stacking, boosting — Ensembling, stacking, bagging: solo "gradient boosting" come descrizione di XGBoost
- [ ] **K-2.2S8** 2.2S8 Ridurre dimensione (data type, pruning, compressione) — Distillazione citata per Bedrock; pruning, compressione e cambio di data type non trattati
- [ ] **K-2.3K4** 2.3K4 Metriche di Clarify — Metriche Clarify non elencate (CI, DPL, DPPL, DI, SHAP); qualche domanda nel banco
- [ ] **K-2.3K5** 2.3K5 Problemi di convergenza — Debugger "contro gradienti anomali e stalli" in una riga; vanishing/exploding solo nel banco
- [ ] **K-2.3S1** 2.3S1 Interpretare metriche e bias del modello — Bias post-training (DPPL, Disparate Impact) solo in 5 domande
- [ ] **K-2.3S2** 2.3S2 Tradeoff performance, tempo, costo — Tradeoff performance, tempo e costo accennati, mai esercitati come tema
- [ ] **K-2.3S5** 2.3S5 Interpretare output con Clarify — SHAP e feature attribution solo nel banco (11 domande); la teoria parla solo di drift di explainability
- [ ] **G-2.3.1** 2.3.1 Perform reproducible experiments (for example, by using MLflow on SageMaker AI, Amazon Bedrock evaluations, Amazon Bedrock Prompt Management).
- [ ] **G-3.3.6** 3.3.6 Manage model versions for repeatability and audits (for example, SageMaker Model Registry, MLflow on SageMaker AI).
- [ ] **C04** MAPE e PR-AUC — MAPE solo nel banco; PR-AUC assente.
- [ ] **C05** SageMaker Canvas — No-code ML, anche per il forecasting al posto di Forecast.
- [ ] **C07** SageMaker Managed Warm Pools — Assente.
- [ ] **C08** TensorBoard in SageMaker — Assente.
- [ ] **C10** SHAP e partial dependence plot — Solo nel banco (8 domande).
- [ ] **C11** Managed Spot Training e checkpointing — Solo nel banco; risparmio fino al 90%.
- [ ] **C13** Tutti gli algoritmi built-in di SageMaker — Oggi 5 su circa 17: aggiungere RCF, k-NN, Factorization Machines, IP Insights, Object2Vec, Seq2Seq, LDA, NTM, PCA, image classification, object detection, semantic segmentation, LightGBM, CatBoost, TabTransformer, AutoGluon.

## Infrastruttura come codice, container e CI/CD (`ch10-infra-cicd`) — 41 voci

- [ ] **K-3.1K4** 3.1K4 Compute in prod e test (CPU, GPU) — CPU/GPU citati per i Training Job; nessuna guida per prod vs test
- [ ] **K-3.1K7** 3.1K7 Edge (Neo) — SageMaker Neo e deploy su edge: 0 teoria, 0 domande
- [ ] **K-3.1S2** 3.1S2 Compute per training e inferenza — Famiglie di istanze (Inferentia, Trainium, Graviton, GPU per training), banda di rete: 0 teoria, 3 domande
- [ ] **K-3.1S5** 3.1S5 Target (endpoint, K8s, ECS, EKS, Lambda) — ECS/EKS in una riga ("controllo totale"), 0 domande; Lambda come target non discusso
- [ ] **K-3.2K1** 3.2K1 On-demand vs provisioned — On-demand vs provisioned: 0 in teoria; provisioned concurrency e provisioned throughput solo nel banco
- [ ] **K-3.2K2** 3.2K2 Confronto scaling policy — Target tracking, step e scheduled scaling: 0 teoria, 2 domande
- [ ] **K-3.2K3** 3.2K3 IaC (CloudFormation, CDK) — CloudFormation e CDK: 0 teoria, 0 domande
- [ ] **K-3.2K4** 3.2K4 Container e servizi container — ECR, ECS, EKS nominati; concetti di containerizzazione non spiegati
- [ ] **K-3.2K5** 3.2K5 Auto scaling per domanda e tempo — Autoscaling "per assorbire i picchi"; scaling su base temporale (scheduled) assente
- [ ] **K-3.2S1** 3.2S1 Best practice (scaling, Spot, EC2, Lambda) — Autoscaling sì; Spot dinamiche, EC2, Lambda dietro l'endpoint no
- [ ] **K-3.2S2** 3.2S2 Provisioning automatico, comunicazione tra stack — Provisioning automatico e comunicazione tra stack: 0
- [ ] **K-3.2S3** 3.2S3 Container (ECR, EKS, ECS, BYOC) — BYOC su ECR sì; build e manutenzione su ECS/EKS no (0 domande)
- [ ] **K-3.2S5** 3.2S5 Deploy con SageMaker SDK — Deploy con SageMaker Python SDK (Model, deploy(), predictor): 0
- [ ] **K-3.2S6** 3.2S6 Metriche di auto scaling — InvocationsPerInstance in una parola chiave; latenza e CPU come metriche di scaling non confrontate
- [ ] **K-3.3K1** 3.3K1 CodePipeline, CodeBuild, CodeDeploy — CodePipeline e CodeBuild dentro SageMaker Projects; CodeDeploy mai citato; quote e capacità assenti
- [ ] **K-3.3K3** 3.3K3 Version control (Git) — "push Git" in una frase; nessuna nozione di Git
- [ ] **K-3.3K5** 3.3K5 Blue/green, canary, linear, rollback — Blue/green nella teoria; canary e linear solo nel banco (10 e 4 domande)
- [ ] **K-3.3K6** 3.3K6 Repository e pipeline insieme — Repository → build → pipeline in una frase
- [ ] **K-3.3S1** 3.3S1 Configurare Code* e stage — Stage e troubleshooting di CodeBuild/CodePipeline non trattati
- [ ] **K-3.3S2** 3.3S2 Gitflow, GitHub Flow — Gitflow e GitHub Flow: 0
- [ ] **K-3.3S5** 3.3S5 Test automatici in CI/CD — Test unitari, di integrazione, end-to-end nelle pipeline: 0 teoria, 1 domanda
- [ ] **G-3.3.2** 3.3.2 Configure and troubleshoot AWS CodeBuild, AWS CodeCommit, AWS CodeDeploy, AWS CodePipeline, and AWS CodeConnections.
- [ ] **G-3.3.4** 3.3.4 Configure automated testing strategies within CI/CD pipelines for traditional ML and AI workloads.
- [ ] **V01** AWS CloudFormation — mai citato
- [ ] **V02** AWS CDK — mai citato
- [ ] **V03** AWS CodeDeploy — mai citato
- [ ] **V09** Amazon API Gateway — mai citato
- [ ] **V10** AWS Batch — mai citato
- [ ] **V12** AWS CodeArtifact — mai citato
- [ ] **V14** AWS Service Catalog — mai citato
- [ ] **V15** AWS Serverless Application Repository — mai citato
- [ ] **V48** Amazon CloudFront — solo nel banco
- [ ] **V50** Amazon ECS — spiegato ma 0 domande
- [ ] **V51** Amazon EKS — spiegato ma 0 domande
- [ ] **V54** AWS CodeCommit — nuovo in-scope MLA-C02
- [ ] **V55** AWS CodeConnections — nuovo in-scope MLA-C02
- [ ] **C06** SageMaker Inference Recommender — Solo in 3 domande.
- [ ] **C15** Famiglie di istanze — M, C, R, P, G, Inf, Trn, Graviton: assenti.
- [ ] **C17** Step di SageMaker Pipelines — Processing, Training, Tuning, Model, Transform, Condition, Callback, Lambda, ClarifyCheck, QualityCheck, Fail, EMR.
- [ ] **C20** SageMaker Neo e deploy su edge — Assente.
- [ ] **C25** Provisioned concurrency del serverless e scale-to-zero dell'async — Solo nel banco.

## Costi, osservabilità e sicurezza avanzata (`ch11-cost-security`) — 42 voci

- [ ] **K-3.1S2** 3.1S2 Compute per training e inferenza — Famiglie di istanze (Inferentia, Trainium, Graviton, GPU per training), banda di rete: 0 teoria, 3 domande
- [ ] **K-4.1K3** 4.1K3 Principi ML Lens — Well-Architected Machine Learning Lens: mai citato
- [ ] **K-4.1S2** 4.1S2 Anomalie in processing e inferenza — Allarmi su violazioni del monitor; errori nei job di processing e nelle pipeline non trattati
- [ ] **K-4.2K1** 4.2K1 Metriche infra (utilizzo, throughput…) — Latenza, errori, invocazioni; disponibilità e fault tolerance (multi-AZ, più istanze) no
- [ ] **K-4.2K2** 4.2K2 X-Ray, Lambda Insights, Logs Insights — X-Ray, CloudWatch Lambda Insights, Logs Insights: 0 teoria, 1 domanda
- [ ] **K-4.2K4** 4.2K4 Tipi di istanza — Famiglie di istanze (memory, compute, general purpose, inference optimized): 0
- [ ] **K-4.2K5** 4.2K5 Cost Explorer, Billing, Trusted Advisor — Cost Explorer, Billing e Cost Management, Trusted Advisor: 0 in teoria, poche menzioni come distrattori
- [ ] **K-4.2K6** 4.2K6 Tagging per allocazione costi — Tagging per allocazione dei costi: una sola domanda vera
- [ ] **K-4.2S2** 4.2S2 Creare trail CloudTrail — Creazione di un trail CloudTrail (multi-region, su S3) non spiegata
- [ ] **K-4.2S3** 4.2S3 Dashboard (QuickSight, CloudWatch) — Dashboard CloudWatch in una riga; QuickSight solo nel banco
- [ ] **K-4.2S5** 4.2S5 Rightsizing (Inference Recommender, Compute Optimizer) — Inference Recommender solo in 3 domande; Compute Optimizer 0
- [ ] **K-4.2S7** 4.2S7 Tagging per cost monitoring — Strategia di tagging assente dalla teoria
- [ ] **K-4.2S8** 4.2S8 Provisioned concurrency, quote, scaling — Provisioned concurrency solo nel banco (7); service quotas mai
- [ ] **K-4.2S9** 4.2S9 Cost Explorer, Trusted Advisor, Budgets — Cost Explorer, Trusted Advisor, AWS Budgets come strumenti: 0 teoria, 3 menzioni come distrattori
- [ ] **K-4.2S10** 4.2S10 Spot, On-Demand, Reserved, Savings Plans — Managed Spot Training nel banco (15); Savings Plans e Reserved Instances solo come distrattore
- [ ] **K-4.3K2** 4.3K2 Sicurezza e compliance di SageMaker — VPC-only e KMS sì; network isolation e cifratura del traffico tra container no
- [ ] **K-4.3K4** 4.3K4 Sicurezza delle pipeline CI/CD — Sicurezza delle pipeline CI/CD: 0
- [ ] **K-4.3S4** 4.3S4 Troubleshooting sicurezza — Troubleshooting di AccessDenied, permessi mancanti, KMS key policy: 0
- [ ] **K-4.3S5** 4.3S5 VPC, subnet, security group — Subnet private sì; security group solo nel banco (6)
- [ ] **G-4.3.1** 4.3.1 Secure continuous integration and continuous delivery (CI/CD) pipelines by checking for code and image vulnerabilities (for example, by using Amazon CodeGuru, Amazon Inspector).
- [ ] **G-4.2.2** 4.2.2 Configure and use tools to troubleshoot and analyze resources (for example, Amazon CloudWatch, Amazon Bedrock AgentCore Observability, AWS X-Ray).
- [ ] **G-4.3.4** 4.3.4 Configure comprehensive monitoring, auditing, compliance, and logging for ML and AI systems (for example, AWS CloudTrail, AWS Config).
- [ ] **V04** AWS X-Ray — mai citato
- [ ] **V07** AWS Trusted Advisor — mai citato
- [ ] **V08** AWS Compute Optimizer — mai citato
- [ ] **V13** Amazon CodeGuru — mai citato
- [ ] **V19** Amazon DevOps Guru — mai citato
- [ ] **V24** AWS Chatbot (Amazon Q Developer in chat applications) — mai citato
- [ ] **V32** AWS Billing and Cost Management — solo nel banco
- [ ] **V38** Amazon QuickSight / Amazon Quick — solo nel banco
- [ ] **V39** AWS Cost Explorer — solo nel banco
- [ ] **V42** AWS Budgets — solo nel banco
- [ ] **V44** AWS Config — solo nel banco
- [ ] **V45** AWS Organizations — solo nel banco
- [ ] **V46** AWS Systems Manager — solo nel banco
- [ ] **V52** AWS Secrets Manager — spiegato ma 1 domanda
- [ ] **V56** Amazon Inspector — nuovo in-scope MLA-C02
- [ ] **C03** Network isolation di SageMaker — EnableNetworkIsolation: assente.
- [ ] **C15** Famiglie di istanze — M, C, R, P, G, Inf, Trn, Graviton: assenti.
- [ ] **C18** Cifratura del traffico tra container — Assente.
- [ ] **C19** Savings Plans e Reserved Instances — Solo come distrattori.
- [ ] **C23** SageMaker Role Manager — Assente.

## GenAI: modelli di fondazione, embedding e RAG avanzato (`ch12-genai-rag`) — 21 voci

- [ ] **G-1.1.7** 1.1.7 Configure scalable vector databases for AI applications (for example, OpenSearch Service, Amazon RDS with pgvector, Amazon S3) based on specifications.
- [ ] **G-1.2.5** 1.2.5 Configure and use embedding models to transform text and image data into numerical representations.
- [ ] **G-1.2.6** 1.2.6 Apply advanced text pre-processing techniques (for example, tokenization, domain-specific augmentation).
- [ ] **G-1.2.7** 1.2.7 Prepare documents for Retrieval Augmented Generation (RAG) applications (for example, chunking strategies, metadata extraction).
- [ ] **G-1.2.9** 1.2.9 Prepare data for FM fine-tuning, continuous pre-training, and model distillation.
- [ ] **G-1.3.6** 1.3.6 Validate AI training data integrity (for example, prompt-response pair validation, content safety screening).
- [ ] **G-2.1.1** 2.1.1 Evaluate and select appropriate FMs from Amazon Bedrock based on task requirements and performance criteria.
- [ ] **G-2.1.2** 2.1.2 Identify fine-tuning strategies for pre-trained FMs to meet business needs.
- [ ] **G-2.1.4** 2.1.4 Evaluate tradeoffs between custom solutions, managed services, pre-trained models, and FMs to meet business needs.
- [ ] **G-2.1.5** 2.1.5 Select Retrieval Augmented Generation (RAG) architecture patterns based on use case requirements.
- [ ] **G-2.1.7** 2.1.7 Assess tradeoffs between AI model performance, latency, and cost.
- [ ] **G-2.2.8** 2.2.8 Apply customization techniques for AI solutions (for example, task-specific prompt engineering, fine-tuning).
- [ ] **G-2.2.9** 2.2.9 Optimize retrieval components and embedding models.
- [ ] **G-3.1.8** 3.1.8 Apply Retrieval Augmented Generation (RAG) system configurations (for example, retrieval strategies, reranking).
- [ ] **G-3.2.7** 3.2.7 Create and manage Amazon Bedrock knowledge bases with vector database configurations, document indexing, and retrieval optimization.
- [ ] **G-3.2.8** 3.2.8 Implement retrieval pipelines to meet business needs.
- [ ] **G-3.3.11** 3.3.11 Configure AI-specific pipeline orchestration for RAG system updates and knowledge base refresh cycles.
- [ ] **G-2.1.3** 2.1.3 Compare and select appropriate ML models, generative AI (GenAI) models, algorithms, and solution templates to meet business needs (for example, interpretability, domain-specific performance, latency).
- [ ] **V35** Amazon Kendra — solo nel banco (MLA-C01)
- [ ] **C01** Parametri di inferenza dei modelli generativi — temperature, top_p, top_k, max tokens, stop sequences: solo nel banco.
- [ ] **C02** LoRA e PEFT — Fine-tuning efficiente nei parametri: assente.

## GenAI in produzione: valutazione, agenti e costi (`ch13-genai-agents`) — 29 voci

- [ ] **G-2.3.7** 2.3.7 Implement integrated human evaluation frameworks (for example, human-in-the-loop workflows, text generation quality assessment).
- [ ] **G-2.3.8** 2.3.8 Apply natural language processing (NLP) evaluation metrics (for example, bilingual evaluation understudy [BLEU], Recall-Oriented Understudy for Gisting Evaluation [ROUGE], BERTScore, semantic similarity).
- [ ] **G-2.3.9** 2.3.9 Perform AI evaluation (for example, model output assessment, content quality validation, bias detection, LLM-as-a-judge frameworks).
- [ ] **G-2.3.10** 2.3.10 Configure RAG system monitoring, including retrieval accuracy assessment.
- [ ] **G-3.1.4** 3.1.4 Evaluate and select appropriate foundation model (FM) deployment options.
- [ ] **G-3.1.5** 3.1.5 Deploy models that were built outside of AWS into AWS environments (for example, Amazon SageMaker AI, Amazon Bedrock Custom Model Import).
- [ ] **G-3.1.6** 3.1.6 Deploy and configure agents for specific tasks, integration with other services and tools, and agent communication protocols.
- [ ] **G-3.1.7** 3.1.7 Configure FM deployment, model hosting, and resource allocation.
- [ ] **G-3.2.9** 3.2.9 Implement agent state management systems.
- [ ] **G-3.2.10** 3.2.10 Implement AI-specific resource scaling for GPU workloads.
- [ ] **G-3.2.11** 3.2.11 Deploy agentic workflow infrastructure.
- [ ] **G-3.3.7** 3.3.7 Manage prompts (for example, Amazon Bedrock Prompt Management).
- [ ] **G-3.3.8** 3.3.8 Implement automated agent deployment pipelines and agent version management.
- [ ] **G-3.3.9** 3.3.9 Implement AI model testing frameworks, including prompt testing.
- [ ] **G-3.3.10** 3.3.10 Configure FM deployment automation with fine-tuned model versioning.
- [ ] **G-4.1.5** 4.1.5 Monitor and automate the management of agent performance and coordination (for example, coordination failure detection, truncated streaming, tool failures).
- [ ] **G-4.1.6** 4.1.6 Configure AI-specific performance monitoring for foundation models (FMs), such as Amazon Bedrock evaluations.
- [ ] **G-4.2.7** 4.2.7 Evaluate cost implications of using FMs for inference in production.
- [ ] **G-4.2.8** 4.2.8 Monitor agent resource consumption patterns.
- [ ] **G-4.2.9** 4.2.9 Manage FM inference costs with usage optimization.
- [ ] **G-4.2.10** 4.2.10 Monitor AI-specific cost patterns (for example, token usage optimization, embedding computation costs, vector database storage optimization).
- [ ] **G-4.3.8** 4.3.8 Select the appropriate credential type to access FMs (for example, Amazon Bedrock API keys, IAM credentials).
- [ ] **G-4.3.9** 4.3.9 Implement safeguards and sensitive data protection to meet application requirements and responsible AI policies (for example, by using Amazon Bedrock Guardrails).
- [ ] **G-2.3.1** 2.3.1 Perform reproducible experiments (for example, by using MLflow on SageMaker AI, Amazon Bedrock evaluations, Amazon Bedrock Prompt Management).
- [ ] **G-2.3.6** 2.3.6 Apply comprehensive model evaluation techniques for traditional ML and GenAI models.
- [ ] **G-4.1.1** 4.1.1 Monitor model performance in production by using Amazon CloudWatch generative AI observability, Amazon Bedrock Model Evaluation, and drift detection pipelines.
- [ ] **G-4.2.2** 4.2.2 Configure and use tools to troubleshoot and analyze resources (for example, Amazon CloudWatch, Amazon Bedrock AgentCore Observability, AWS X-Ray).
- [ ] **V53** Amazon Bedrock AgentCore — nuovo in-scope MLA-C02
- [ ] **C24** SageMaker HyperPod e cluster GPU — Assente.

## Servizi AI pronti e catalogo dei servizi d'esame (`ch14-ai-services`) — 16 voci

- [ ] **K-2.1K2** 2.1K2 AI services (Translate, Transcribe, Rekognition, Bedrock) — Comprehend, Rekognition, Textract, Bedrock nella teoria; Translate, Transcribe, Polly, Lex, Personalize solo nel banco
- [ ] **V11** Amazon Augmented AI (A2I) — mai citato
- [ ] **V18** Amazon Comprehend Medical — mai citato
- [ ] **V20** Amazon Fraud Detector — mai citato (MLA-C01)
- [ ] **V21** AWS HealthLake — mai citato
- [ ] **V22** Amazon Lookout for Equipment, Metrics, Vision — mai citato (MLA-C01)
- [ ] **V23** Amazon Q — mai citato (MLA-C01)
- [ ] **V28** Amazon Transcribe — solo nel banco
- [ ] **V29** Amazon Polly — solo nel banco
- [ ] **V30** Amazon Lex — solo nel banco
- [ ] **V31** Amazon Personalize — solo nel banco
- [ ] **V35** Amazon Kendra — solo nel banco (MLA-C01)
- [ ] **V36** Amazon Translate — solo nel banco
- [ ] **V-CAT** Catalogo completo dei servizi in-scope MLA-C01 e MLA-C02 — Ogni servizio dell'Appendix MLA-C01 e dell'elenco in-scope MLA-C02 con una riga 'a cosa serve / quando sceglierlo', più l'elenco dei servizi fuori ambito da non confondere.
- [ ] **C05** SageMaker Canvas — No-code ML, anche per il forecasting al posto di Forecast.
- [ ] **C22** Alternative ad Amazon Forecast — Forecast chiuso ai nuovi clienti: Canvas, DeepAR, Chronos.

## Correzioni ai capitoli 1-7, scheda rapida e banco esistente (`fix`) — 21 voci

- [ ] **E01** Durata d'esame: 65 domande in 170 minuti — ch1 (slide 1, riassunto, copione), ch7 (slide 1), home, domande.html, timer qbank-ui.js; domande ch1-q02, ch1-q13, ch1-ext15, ch7-q01, ch7-ext01. Corretto: MLA-C01 65 domande in 130 minuti; MLA-C02 beta 85 domande in 170 minuti; in entrambi 2,0 minuti a domanda.
- [ ] **E02** Nessun cenno all'MLA-C02 — ch1, ch7, home. L'MLA-C01 in inglese è finito il 28/09/2026; dal 29/09/2026 si sostiene la beta MLA-C02 (85 domande, 170 minuti, 75 USD), GA a inizio 2027; MLA-C01 resta in giapponese, coreano, cinese semplificato fino alla GA.
- [ ] **E03** Serverless con payload 6 MB — ch4 (slide 1), ch7 (slide 4, copione), scheda rapida. Corretto: serverless 4 MB e 60 s; real-time 25 MB oggi (6 MB al lancio dell'esame), 60 s; async 1 GB e 1 ora.
- [ ] **E04** Cosa il serverless non supporta — ch4: niente GPU, configurazione VPC, network isolation, data capture, Model Monitor, varianti multiple, multi-model endpoint, inference pipeline.
- [ ] **E05** Chiave sbagliata ch1-q39 — Il difetto indicato è studiare prima i domini 1 e 2; la spiegazione descrive l'opzione 0 (trascurare la preparazione dei dati).
- [ ] **E06** Chiave sbagliata ch3-ext04 — Warm start su dati nuovi: serve TRANSFER_LEARNING, non IDENTICAL_DATA_AND_ALGORITHM.
- [ ] **E07** Chiave sbagliata ch4-q40 — La LambdaStep non può attendere una decisione umana: serve CallbackStep, oppure approvazione nel Model Registry con EventBridge.
- [ ] **E08** Lingue d'esame ch1-ext01 — MLA-C01: inglese (fino al 28/09/2026), giapponese, coreano, cinese semplificato. Francese e spagnolo non esistono.
- [ ] **E09** Dominio 4 con la GenAI (ch1-q10, ch1-q25) — Nell'MLA-C01 il dominio 4 è ML Solution Monitoring, Maintenance, and Security; Bedrock sta nel 2.1. Nell'MLA-C02 la GenAI è distribuita in tutti i domini.
- [ ] **E10** Campionamento data capture 10-100% — ch5 (slide 1), ch7 (slide 4), scheda rapida: InitialSamplingPercentage va da 0 a 100.
- [ ] **E11** Amazon Forecast come risposta corretta — ch6-q07, ch6-q28, ch7-q32, ch7-ext10: Forecast è chiuso ai nuovi clienti dal 29/07/2024 e non è in-scope; usare SageMaker Canvas (o DeepAR, Chronos).
- [ ] **E12** Aritmetica ch7-ext01 — 65 × 2,5 = 162,5 minuti; e il ritmo reale è 2,0 minuti a domanda.
- [ ] **E13** Spot fino al 70% (ch3-q16) — Managed Spot Training: fino al 90% rispetto all'on-demand.
- [ ] **E14** Async 6 MB (ch4-q17, spiegazione) — Async fino a 1 GB e 1 ora.
- [ ] **E15** EMRFS consistent view (ch2-ext16) — Superato: S3 ha consistenza forte da dicembre 2020.
- [ ] **E16** Step di Pipelines 'Evaluation' — ch4 (slide 5), scheda rapida: Evaluation non è un tipo di step (è una ProcessingStep); aggiungere Callback, Lambda, Tuning, ClarifyCheck, QualityCheck.
- [ ] **E17** Stati del Model Registry — ch4 (slide 6), ch7, scheda rapida: il valore API è PendingManualApproval (oltre ad Approved, Rejected).
- [ ] **E18** F1 e AUC ideali su dati sbilanciati — ch3 (parole chiave, copione): con sbilanciamento forte la ROC-AUC è ottimista; meglio PR-AUC e F1.
- [ ] **E19** Range XGBoost presentati come limiti — ch3 (slide 2): eta 0,05-0,3 e max_depth 3-10 sono range tipici di tuning; default eta 0,3, max_depth 6.
- [ ] **E20** Quiz in inglese e scheda rapida nei JSON — content/chapters-*.json: il contratto chiede quiz di fine capitolo in italiano; la scheda rapida sta in chapters-2.json mentre il README dice il contrario.
- [ ] **X05** Home e README aggiornati — Conteggi (capitoli, minuti audio, domande), MLA-C02, fonti, nome progetto Pages mla-c01-studio.

## Motore banco domande e simulazione (qbank.js, qbank-ui.js, tools) (`engine`) — 9 voci

- [ ] **E01** Durata d'esame: 65 domande in 170 minuti — ch1 (slide 1, riassunto, copione), ch7 (slide 1), home, domande.html, timer qbank-ui.js; domande ch1-q02, ch1-q13, ch1-ext15, ch7-q01, ch7-ext01. Corretto: MLA-C01 65 domande in 130 minuti; MLA-C02 beta 85 domande in 170 minuti; in entrambi 2,0 minuti a domanda.
- [ ] **S01** Timer a 2,0 minuti a domanda — Oggi 2,6 (170/65). MLA-C01 65/130 e MLA-C02 85/170 danno entrambi 2,0.
- [ ] **S02** Preset d'esame da 65 e 85 domande — Simulazione 'MLA-C01' (65 domande, 130 minuti, pesi 28/26/22/24) e 'MLA-C02' (85 domande, 170 minuti, pesi 28/24/24/24), oltre a 10/25/50.
- [ ] **S03** Escludere le domande META dalla simulazione — Le 82 domande su formato, punteggio e tattiche non allenano competenze tecniche.
- [ ] **S04** Pesca per peso dei domini — La simulazione pesca rispettando i pesi del dominio dell'esame scelto.
- [ ] **S05** Domande a risposta multipla — Schema (answer come array, 5-6 opzioni, 'Select TWO/THREE'), UI con checkbox, punteggio tutto-o-niente, controlli aggiornati; domande multiple in tutti i domini.
- [ ] **S06** Soglia di superamento al 75% — Il 720/1000 scalato non equivale al 72% di risposte giuste: margine prudente.
- [ ] **S07** Metadati dominio/task/esame su ogni domanda — Campi domain, task, exam per tutte le domande (le 490 esistenti dalla classificazione del report), necessari alla pesca per dominio e ai preset.
- [ ] **X08** Controllo di copertura automatico — tools/check_coverage.py: per ogni voce di questa lista, presenza nella teoria e nel banco.

## Struttura del sito (registro capitoli, mappa, home, README, player) (`site`) — 6 voci

- [ ] **E20** Quiz in inglese e scheda rapida nei JSON — content/chapters-*.json: il contratto chiede quiz di fine capitolo in italiano; la scheda rapida sta in chapters-2.json mentre il README dice il contrario.
- [ ] **X01** Registro capitoli e mappa da 7 a 14 capitoli — app.js, map.js, qbank.js, domande.html, tracker: i 7 capitoli nuovi caricati, navigabili e con banco domande.
- [ ] **X02** Un file JSON per capitolo — content/chapters/<id>.json (proprietà chiara per ogni capitolo), loader, tools TTS e timing aggiornati.
- [ ] **X03** Narrazione per slide e timing automatico — slides[].narration; script = narrazioni unite; make_timing ricava i salti di slide senza tabelle a mano.
- [ ] **X04** Fonti online visibili per capitolo — Campo sources[] mostrato nella pagina capitolo.
- [ ] **X05** Home e README aggiornati — Conteggi (capitoli, minuti audio, domande), MLA-C02, fonti, nome progetto Pages mla-c01-studio.

## Sintesi vocale e timing (`audio`) — 2 voci

- [ ] **X06** Audio dei 7 capitoli nuovi — Sintesi Chatterbox (voce Persona4) e timing.
- [ ] **X07** Ri-sintesi dei capitoli corretti — Ogni capitolo 1-7 o scheda rapida il cui copione cambia va risintetizzato.

## Domande nuove e riequilibrio del banco (`banco`) — 3 voci

- [ ] **S05** Domande a risposta multipla — Schema (answer come array, 5-6 opzioni, 'Select TWO/THREE'), UI con checkbox, punteggio tutto-o-niente, controlli aggiornati; domande multiple in tutti i domini.
- [ ] **S08** Bilanciamento del banco per dominio e task — Dopo l'integrazione la quota per dominio deve avvicinarsi ai pesi (D1 28%) e i task 3.2 e 4.2 non devono più essere i meno allenati.
- [ ] **S09** Allenare ECS, EKS e Secrets Manager — Spiegati nella teoria ma con 0, 0 e 1 domanda.
