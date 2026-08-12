FROM maven:3.8.5-openjdk-17-slim AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN groupadd -r appgroup && useradd -r -g appgroup -u 1001 appuser
COPY --from=build --chown=appuser:appgroup /workspace/target/*.jar app.jar
USER appuser
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]
