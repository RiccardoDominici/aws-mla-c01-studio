# Lacune delle lezioni rispetto al banco domande

Elenco generato dal campo `lesson.approx` di `content/questions/*.json`: 127 domande
testano un punto che nessuna slide del corso insegna (né nei bullets né nella narration).
Il pulsante del banco porta all'argomento più vicino e avvisa lo studente.
Colmare una lacuna = aggiungere il punto alla slide indicata e togliere `approx` dalla domanda.

Nota: in ch1-exam-guide le narration sono sfasate di una slide rispetto ai titoli;
lì `approx` è stato valutato solo su titoli e bullets.

Conflitto di contenuto: ch5-q28 e ch5-ext25 si aspettano 'una regola EventBridge sulle
violazioni del monitor', mentre ch5 slide 10 insegna 'Perché non EventBridge'. Va deciso
quale dei due è giusto e allineato l'altro.

## ch1-exam-guide (11)

- `ch1-q15` → ch1-exam-guide slide 1: What should candidates know about unscored items on the MLA-C01 exam?
- `ch1-q32` → ch1-exam-guide slide 1: A forum post claims candidates can spot unscored items by their length. How should a candidate react?
- `ch1-ext02` → ch1-exam-guide slide 7: Are there formal prerequisites that a candidate must hold before registering for MLA-C01?
- `ch1-ext09` → ch1-exam-guide slide 1: A candidate scores strongly in three domains but weakly in one. How is the pass/fail decided?
- `ch1-ext10` → ch1-exam-guide slide 4: What kind of domain-level feedback appears on the MLA-C01 score report?
- `ch1-ext15` → ch1-exam-guide slide 1: What is the break policy during the 130-minute MLA-C01 session?
- `ch1-ext16` → ch1-exam-guide slide 6: A stem asks for the solution with the LEAST operational overhead. What is the question really testing?
- `ch1-ext17` → ch1-exam-guide slide 1: What benefit does AWS commonly provide after a candidate passes an exam like MLA-C01?
- `ch1-ext20` → ch1-exam-guide slide 1: A candidate tries to compute exactly how many scored versus unscored items they faced. What is the flaw?
- `ch1-ext24` → ch7-practice slide 19: During an online-proctored MLA-C01 session, which candidate behavior is most likely to trigger a policy violation?
- `ch1-ext25` → ch1-exam-guide slide 4: A candidate masters Domain 3 (22%) but neglects Domain 1 (28%) and still passes. What does this prove about MLA-C01 scor

## ch2-data-prep (24)

- `ch2-q04` → ch2-data-prep slide 5: New sensor files arrive in S3 unpredictably and must trigger feature processing within seconds. What ingestion pattern s
- `ch2-ext02` → ch2-data-prep slide 7: An engineer must retrieve only a few columns from a large CSV object in S3 for a quick data check, without downloading t
- `ch2-ext03` → ch2-data-prep slide 2: Training data in S3 changes frequently and a bad overwrite corrupted a curated prefix last week. How can the team recove
- `ch2-ext05` → ch8-data-advanced slide 6: A MySQL database holds customer history that must be loaded continuously into S3 for a churn model, including ongoing ch
- `ch2-ext13` → ch2-data-prep slide 7: Two teams run Athena queries against one data lake and finance needs separate cost tracking plus per-team concurrency li
- `ch2-ext14` → ch2-data-prep slide 7: An Athena query joins S3 orders with a live MySQL catalog for a training extract. Which Athena feature enables SQL acros
- `ch2-ext15` → ch2-data-prep slide 8: A data scientist runs Terabyte-scale Spark feature jobs only twice a month and wants to avoid managing clusters. Which E
- `ch2-ext17` → ch2-data-prep slide 9: A team cleans data in SageMaker Data Wrangler and needs a custom pandas transformation plus a join with a second dataset
- `ch2-ext18` → ch2-data-prep slide 10: A Feature Store feature group holds click features with a 24-hour time-to-live for live lookup. What happens to expired 
- `ch2-ext23` → ch2-data-prep slide 15: A text classifier consumes support tickets of very different lengths. Which preprocessing step lets mini-batch training 
- `ch2-b02` → ch8-data-advanced slide 9: Five analytics consumers each read the same Kinesis shard with GetRecords. They now get ProvisionedThroughputExceededExc
- `ch2-b09` → ch2-data-prep slide 3: A team stores clickstream data in S3 for Athena and wants fewer bytes scanned per query. Which two statements about colu
- `ch2-b11` → ch2-data-prep slide 5: A Firehose stream transforms records with a Lambda function. On large batches the function runs about 7 minutes, and del
- `ch2-b13` → ch2-data-prep slide 9: A Data Wrangler flow imports only the first 50,000 rows of a 10 million row file and applies Encode Categorical. In prod
- `ch2-b14` → ch2-data-prep slide 9: Which statement about scheduling a Data Wrangler job is correct?
- `ch2-b16` → ch2-data-prep slide 11: A team reads its Feature Store offline store in the Apache Iceberg table format and runs an incremental daily job that s
- `ch2-b17` → ch2-data-prep slide 11: A privacy request requires removing a record from a Feature Store feature group that has an offline store. The team call
- `ch2-b23` → ch2-data-prep slide 9: A team exports a Data Wrangler flow to an S3 destination node. Which two settings can it configure for the output? (Sele
- `ch2-b24` → ch2-data-prep slide 9: A team updates an existing Feature Store feature group from a Data Wrangler flow. Which two statements are correct? (Sel
- `ch2-b29` → ch8-data-advanced slide 17: A team needs a pre-training metric for a multi-category outcome in which a value close to 1 means one outcome category s
- `ch2-b30` → ch8-data-advanced slide 17: A Clarify report gives a Conditional Demographic Disparity of +0.15 for an admissions dataset. Which reading is correct?
- `ch2-b33` → ch2-data-prep slide 2: A healthcare company must keep audit records unchangeable for seven years, even for the account root user. Which Object 
- `ch2-b35` → ch8-data-advanced slide 20: A team tags S3 buckets and Glue tables with IAM resource tags and expects those tags to control Lake Formation access. W
- `ch2-b41` → ch2-data-prep slide 2: Which two Amazon S3 features help meet write-once-read-many (WORM) requirements? (Select TWO.)

## ch3-model-dev (7)

- `ch3-q26` → ch3-model-dev slide 17: A credit-risk model must output calibrated default probabilities, not just labels. Which loss fits model selection?
- `ch3-q45` → ch3-model-dev slide 3: A team must choose K for customer segmentation with K-Means. Which selection method is sound?
- `ch3-ext02` → ch3-model-dev slide 13: A custom PyTorch container prints lines like Validation-loss=0.25 to stdout. How should the team make an AMT job tune on
- `ch3-ext10` → ch3-model-dev slide 13: A team tunes SageMaker K-Means clustering with AMT. Which objective metric configuration is valid?
- `ch3-ext11` → ch3-model-dev slide 5: A team classifies documents with 100,000 sparse TF-IDF features and needs fast linear training at scale. Which algorithm
- `ch3-ext12` → ch3-model-dev slide 10: A retailer needs immediate forecasts for brand-new stores with almost no history and no training budget. Which JumpStart
- `ch3-ext24` → ch3-model-dev slide 20: A team tunes hyperparameters with regular k-fold and reports the best tuning score as final performance. What evaluation

## ch4-deploy (13)

- `ch4-q41` → ch4-deploy slide 3: A flash-sale recommender must retrain hourly and serve traffic spikes instantly. Which combination meets both latency go
- `ch4-q42` → ch4-deploy slide 19: An Airflow DAG on MWAA must trigger SageMaker training and wait before downstream tasks. What is the correct pattern?
- `ch4-ext25` → ch10-infra-cicd slide 4: A clinic serves PHI text through BYOC with strict network and key controls. Which combo meets supply-chain and data rule
- `ch4-b15` → ch4-deploy slide 6: A batch transform job reads CSV files where some quoted fields contain embedded newline characters. The team sets SplitT
- `ch4-b19` → ch4-deploy slide 4: Which TWO statements about containers on Serverless Inference are correct? (Select TWO.)
- `ch4-b23` → ch10-infra-cicd slide 8: Which TWO values are valid ScalableDimension values for SageMaker resources with Application Auto Scaling? (Select TWO.)
- `ch4-b26` → ch4-deploy slide 1: Which THREE statements about the AWS::SageMaker::Endpoint resource in CloudFormation are correct? (Select THREE.)
- `ch4-b31` → ch4-deploy slide 2: Which TWO statements about invoking SageMaker endpoints are correct? (Select TWO.)
- `ch4-b32` → ch4-deploy slide 2: A developer wants to stream tokens from a model to a chatbot front end. Which Boto3 call and condition apply?
- `ch4-b39` → ch13-genai-agents slide 10: Which THREE statements about inference components are correct? (Select THREE.)
- `ch4-b40` → ch13-genai-agents slide 10: A client calls InvokeEndpoint on a shared endpoint that hosts several inference components. Which parameter routes the c
- `ch4-b44` → ch4-deploy slide 13: A team registers a scalable target for the instance count of one variant, with minimum 1 and maximum 8. Which ResourceId
- `ch4-b45` → ch4-deploy slide 5: A data scientist wants to test an asynchronous endpoint from the Test inference tab in SageMaker Studio. What is the cor

## ch5-monitor-security (17)

- `ch5-q20` → ch5-monitor-security slide 8: On-call engineers get too many false-positive endpoint pages. What alarm design helps?
- `ch5-q23` → ch11-cost-security slide 14: A regulated bank needs tamper-evident audit history of all SageMaker changes. What design works?
- `ch5-q28` → ch5-monitor-security slide 9: How do you trigger automatic retraining when Model Monitor reports violations?
- `ch5-q36` → ch4-deploy slide 11: What evidence justifies promoting a challenger model after an A/B test?
- `ch5-q41` → ch5-monitor-security slide 14: What is the best KMS key strategy for isolating dev, staging, and production ML data?
- `ch5-ext14` → ch5-monitor-security slide 8: Clients send malformed payloads that raise 4xx errors without crashing the endpoint. How can the team get paged on a sur
- `ch5-ext20` → ch11-cost-security slide 14: Security must run SQL forensics over SageMaker API activity across regions for the last year. Which approach scales best
- `ch5-ext22` → ch5-monitor-security slide 13: Only callers inside an approved VPC may invoke a sensitive endpoint. Which IAM enforcement fits?
- `ch5-ext24` → ch5-monitor-security slide 14: The team rotates the KMS CMK yearly but retraining code must keep working without edits. What practice makes rotation se
- `ch5-ext25` → ch5-monitor-security slide 9: A monitoring schedule detects severe data drift at 3 AM. Which event pattern wakes the retraining workflow?
- `ch5-b13` → ch5-monitor-security slide 7: An endpoint has two production variants, and the team wants per-variant invocation and error counts in CloudWatch. Which
- `ch5-b14` → ch5-monitor-security slide 5: A monitoring setup runs bias and explainability jobs hourly on a large endpoint, and its cost has jumped. The decisions 
- `ch5-b29` → ch11-cost-security slide 19: A role in account A has an identity policy that allows s3:GetObject, and the bucket's resource policy in the same accoun
- `ch5-b31` → ch11-cost-security slide 18: For a managed secret whose service supports it, which rotation option requires no Lambda function from the team?
- `ch5-b36` → ch5-monitor-security slide 13: A security team wants to stop developers from creating long-term Bedrock API keys that last more than 90 days. Which con
- `ch5-b39` → ch11-cost-security slide 14: A security team needs object-level records of reads and writes to one captured-data bucket, but not every S3 action in t
- `ch5-b41` → ch11-cost-security slide 14: Which TWO statements about AWS Config rules are correct? (Select TWO.)

## ch6-genai (7)

- `ch6-q27` → ch6-genai slide 18: A video service wants recommendations to adapt within the current viewing session as users click. How should it feed the
- `ch6-q28` → ch6-genai slide 19: A planner wants to preview how a planned promotion would change the demand forecast without editing history. Which featu
- `ch6-q43` → ch14-ai-services slide 7: A marketplace adds hundreds of new listings daily with no interaction history. How should Personalize handle these cold-
- `ch6-q44` → ch6-genai slide 19: SageMaker Canvas must predict demand for brand-new products with almost no sales history. Which cold-start strategy is s
- `ch6-ext12` → ch6-genai slide 10: A refund Agent must pause before executing high-value refunds so a human can approve the action. Which design fits?
- `ch6-ext21` → ch6-genai slide 10: A claims workflow needs deterministic multi-step orchestration: validate input, retrieve policy text, summarize, then es
- `ch6-ext22` → ch13-genai-agents slide 2: A team runs a Bedrock model evaluation job comparing summarization and extractive Q&A outputs against references. Which 

## ch7-practice (5)

- `ch7-q22` → ch7-practice slide 3: An option says a solution will always be cheapest in every possible case. How should you treat it?
- `ch7-q40` → ch7-practice slide 7: A scenario claims dashboard trends prove a campaign caused sales uplift. What is the flaw?
- `ch7-ext03` → ch7-practice slide 2: A tactic guide suggests reading the last sentence of a long scenario first. Why does this help on MLA-C01 questions?
- `ch7-ext07` → ch7-practice slide 3: An option states a solution is the cheapest choice in all regions and all workloads forever. How should a test-taker tre
- `ch7-ext25` → ch7-practice slide 7: A dashboards-only analysis claims a campaign caused a sales uplift. Which reasoning flaw should the candidate spot?

## ch8-data-advanced (31)

- `ch8-q032` → ch8-data-advanced slide 9: Which two statements about Kinesis enhanced fan-out consumers are correct? (Select TWO.)
- `ch8-q047` → ch8-data-advanced slide 12: Which two statements about categorical encodings are correct? (Select TWO.)
- `ch8-q066` → ch8-data-advanced slide 17: Which two statements about Clarify pre-training bias metrics are correct? (Select TWO.)
- `ch8-q086` → ch8-data-advanced slide 5: A web application needs a managed in-memory store for session data that uses Valkey, Memcached or Redis OSS, and the tea
- `ch8-q091` → ch8-data-advanced slide 7: A training team wants the lowest input latency for a dataset stored in an S3 Express One Zone directory bucket. Which th
- `ch8-q097` → ch8-data-advanced slide 9: A company with a modest streaming workload is offered On-demand Advantage for its account. Which statement is correct?
- `ch8-q099` → ch8-data-advanced slide 9: A provisioned stream already has 20 registered enhanced fan-out consumers, and a 21st application needs dedicated throug
- `ch8-q100` → ch8-data-advanced slide 4: A team provisions an io2 Block Express volume at 50,000 IOPS and attaches it to an instance type that is not Nitro-based
- `ch8-q102` → ch8-data-advanced slide 9: A team sends 600 records with PutRecords to a stream. Which two statements about PutRecords and shard write limits are c
- `ch8-q107` → ch8-data-advanced slide 16: An automated labeling job stops with an error saying that more than 10 percent of a random sample failed. Which first ch
- `ch8-q108` → ch8-data-advanced slide 10: A team adds a Lambda transformation to a Firehose stream. Which two statements about the documented limits are correct? 
- `ch8-q109` → ch8-data-advanced slide 12: A tree-based model accepts missing values natively. In the Data Wrangler Ordinal encode transform, which invalid handlin
- `ch8-q111` → ch8-data-advanced slide 14: A team prepares image and text samples for SageMaker training. Which two statements are correct? (Select TWO.)
- `ch8-q112` → ch8-data-advanced slide 12: A linear model uses an hour-of-day feature derived from a timestamp. Which Data Wrangler embedding mode does the documen
- `ch8-q113` → ch8-data-advanced slide 12: A column of ordered shirt sizes has some missing values. The team wants the Ordinal encode transform to fail immediately
- `ch8-q114` → ch8-data-advanced slide 12: A team vectorizes product descriptions in Data Wrangler and wants short tokens such as 'a' and 'in' removed. Which two s
- `ch8-q115` → ch8-data-advanced slide 12: A text column has millions of rows, and the team needs the fastest vectorization with a fixed number of output features.
- `ch8-q116` → ch8-data-advanced slide 15: A product feed must have an email value in at least 95 percent of its rows. Which DQDL rule expresses this requirement?
- `ch8-q117` → ch8-data-advanced slide 15: A Glue Data Quality rule reads (ColumnValues "age" >= 26) OR (ColumnLength "name" >= 4) and must pass each row that meet
- `ch8-q118` → ch8-data-advanced slide 15: A Glue Data Quality rule counts only rows where region is 'EU', written as a where clause. The job runs on AWS Glue 3.0.
- `ch8-q119` → ch8-data-advanced slide 15: Which DQDL rule places the where clause in the documented position when the rule also has a threshold?
- `ch8-q120` → ch8-data-advanced slide 15: A team plans Glue Data Quality checks in the Data Catalog. Which two statements are correct? (Select TWO.)
- `ch8-q121` → ch8-data-advanced slide 15: An ETL job tags each Glue Data Quality rule with labels for team and criticality. Which two label limits does DQDL docum
- `ch8-q122` → ch8-data-advanced slide 15: An ETL job evaluates Glue Data Quality rules with row-level results, but the labels on the rules do not appear in the ro
- `ch8-q123` → ch8-data-advanced slide 15: A data quality rule needs a long SQL query that would exceed the query size limit if written inline. Which DQDL feature 
- `ch8-q124` → ch8-data-advanced slide 15: A Distribution analyzer on a salary column runs every night in an ETL job, and the team wants the histogram bins to stay
- `ch8-q130` → ch8-data-advanced slide 19: Sample test IDs in a staging bucket match a custom data identifier, and the compliance team wants Macie to ignore them i
- `ch8-q131` → ch8-data-advanced slide 19: A security team wants a deep analysis of two named S3 buckets, with custom criteria and a recurring schedule. Which Maci
- `ch8-q132` → ch8-data-advanced slide 15: A CSV export writes missing middle names as empty strings instead of nulls. Which DQDL keyword counts those values as mi
- `ch8-q134` → ch8-data-advanced slide 15: A team sets compositeRuleEvaluation.method to ROW for a Glue Data Quality ruleset. Which two rule types are documented a
- `ch8-q135` → ch8-data-advanced slide 20: A Lake Formation data filter must return only the rows where product_type equals pharma. Which row filter expression use

## ch10-infra-cicd (4)

- `ch10-q007` → ch10-infra-cicd slide 2: Which TWO statements about running model workloads on AWS Batch and Amazon ECS are correct? (Select TWO.)
- `ch10-q035` → ch10-infra-cicd slide 6: An engineer creates an endpoint with boto3 right after creating its endpoint configuration, and the call sometimes fails
- `ch10-q036` → ch10-infra-cicd slide 6: A developer writes a boto3 script that creates an endpoint configuration. Which TWO parameters are required in that call
- `ch10-q056` → ch10-infra-cicd slide 14: A company moves Git repositories to AWS CodeCommit. Developers need code review with pull requests and notifications whe

## ch12-genai-rag (1)

- `ch12-q011` → ch12-genai-rag slide 10: A team uses hierarchical chunking with very large parent chunks on an S3 Vectors store, and ingestion fails with a metad

## ch14-ai-services (7)

- `ch14-q010` → ch14-ai-services slide 2: A healthcare data team must keep protected health information out of persistent storage in the NLP service. Which fact a
- `ch14-q023` → ch14-ai-services slide 3: A post-call analytics pipeline receives a 3 GB audio file that must be analyzed with Call Analytics. Which statement is 
- `ch14-q025` → ch14-ai-services slide 3: Which TWO features of Amazon Transcribe help a contact center react during a live call? (Select TWO.)
- `ch14-q031` → ch14-ai-services slide 4: Which TWO requests are valid for Amazon Polly? (Select TWO.)
- `ch14-q066` → ch14-ai-services slide 8: A team that used time series forecasting in Amazon Forecast wants to build the same kind of predictions programmatically
- `ch14-q068` → ch14-ai-services slide 8: A company wants a no-code model on SageMaker that can also summarize and categorize documents with a chat interface. Whi
- `ch14-q069` → ch14-ai-services slide 8: A company wants ready-to-use models that extract insights from images, documents and text in Canvas without training a m

