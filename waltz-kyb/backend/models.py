from sqlalchemy import Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    formation_state = Column(String, nullable=False)
    property_state = Column(String, nullable=False)
    closing_date = Column(String, nullable=True)
    status = Column(String, default="new")  # new / review / approved
    created_at = Column(DateTime, server_default=func.now())

    members = relationship("DealMember", back_populates="deal", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="deal", cascade="all, delete-orphan")
    facts = relationship("EntityFact", back_populates="deal", cascade="all, delete-orphan")
    rules = relationship("RuleResult", back_populates="deal", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="deal", cascade="all, delete-orphan")


class DealMember(Base):
    __tablename__ = "deal_members"

    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False)
    name = Column(String, nullable=False)
    ownership_pct = Column(Float, nullable=True)
    role = Column(String, nullable=True)

    deal = relationship("Deal", back_populates="members")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False)
    doc_type = Column(String, nullable=False)  # formation / ein / oa / cogs
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now())
    extracted_json = Column(Text, nullable=True)

    deal = relationship("Deal", back_populates="documents")


class EntityFact(Base):
    __tablename__ = "entity_facts"

    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False)
    field_key = Column(String, nullable=False)
    field_value = Column(Text, nullable=True)
    sources = Column(Text, nullable=True)  # JSON array of source doc types
    is_consistent = Column(Boolean, default=True)
    conflicts = Column(Text, nullable=True)  # JSON array of conflict strings
    manually_overridden = Column(Boolean, default=False)

    deal = relationship("Deal", back_populates="facts")


class RuleResult(Base):
    __tablename__ = "rule_results"

    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False)
    rule_id = Column(String, nullable=False)  # e.g. "F1", "E2", "O10"
    status = Column(String, default="pending")  # pass / flag / fail / manual / pending
    evidence = Column(Text, nullable=True)
    question = Column(Text, nullable=True)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)

    deal = relationship("Deal", back_populates="rules")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id"), nullable=False)
    action = Column(Text, nullable=False)
    performed_by = Column(String, default="reviewer")
    performed_at = Column(DateTime, server_default=func.now())

    deal = relationship("Deal", back_populates="audit_logs")
